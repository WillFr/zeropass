"use strict";

import * as bin from "./binary.js";
import { encrypted2Data, data2Encrypted } from "./crypto.js";
import { Mutex } from "./mutex.js";

const allKeysKey = "allKeys"
const allKeysPwKey = "allKeysPw"
const errNotUnlocked = new Error("Cannot use storage without first unlocking it. Did you await the unlock operation ?")

export class ChromeLocalStorage {
    async get(key){
        let res = await chrome.storage.local.get(key)
        if(!(key in res)){ return null}
        let val = res[key]
        return val
    }
    async getAll(keys){
        let res = await chrome.storage.local.get(keys)
        return res
    }

    async set(key, value){
        let __all__ = (await chrome.storage.local.get("__all__"))["__all__"]
        if(__all__ === undefined ){ __all__ = []}
        __all__.push(key)
        await chrome.storage.local.set({[key] : value})
        await chrome.storage.local.set({"__all__": __all__})
    }
    async deleteAll(keys){
        await chrome.storage.local.remove(keys)
    }

    async getAllStorage(){
        let __all__ = (await chrome.storage.local.get("__all__"))["__all__"]
        __all__.push["__all__"]
        let ret = {}
        for(let k of __all__){
            ret[k] = (await chrome.storage.local.get(k))[k]
        }
        return ret
    }
    async setAllStorage(obj){
        await chrome.storage.local.set(obj)
    }

    async clear(){
        return await chrome.storage.local.clear()
    }
}

async function cloudReq(apiKey, method, url, body){
    let conf = {
        method: method,
        headers:{"X-api-key": apiKey},
    }
    //console.trace("FETCH ", url, conf)
    if(body !== undefined && body != null){
        conf.body = body
    }
    let response = await fetch(apiDomain + url, conf)
    
    if(response.status == 401){
        console.error("Invalid api key")
        throw new Error("Invalid api key")
    }
    if(response.status > 499){
        console.error("Backend error",  url, conf, response)
        throw new Error("API backend responsed with an error: "+response.status)
    }
    return response
}



const apiDomain="https://0pass.me"
//const apiDomain="http://localhost:3000"
export class CloudStorage {
    constructor(apiKey){
        this.apiKey = apiKey
        this.lock = new Mutex()
        this.connected = false
    }

    async cloudReq(method, url, body){
        let release = await this.lock.lock()
        try{
            let response = await cloudReq(this.apiKey, method, url, body)
            this.connected = response.status < 400
            return response
        } finally {
            release()
        }
    }
    
    async get(key){
        try{
            let response = await this.cloudReq("GET", "/api/storage/"+key)
            if(response.status == 404){ return null }
            
            return await response.text()
        } catch(err) { return null }
    }
    async getAll(keys){
        try{
            let response = await this.cloudReq("POST", "/api/storage/getAll", JSON.stringify(keys))
            if(response.status == 404){ return [] }
            return await response.json()
        } catch(err) { return [] }
    }
    async set(key, value){
        try{
            await this.cloudReq("PUT", "/api/storage/"+key, value)
        } catch(err) {}
    }
    async deleteAll(keys){
        try{
            await this.cloudReq("POST", "/api/storage/deleteAll", JSON.stringify(keys))
        } catch(err) {}
    }
    async getAllStorage(){
        try{
            let response = await this.cloudReq("GET", "/api/storage")
            if(response.status == 404){ return {} }
            let body = await response.text()
            return body == "" ? {} : JSON.parse(body) 
        } catch(err) { return {}}
    }
    async setAllStorage(obj){
        try{
            await this.cloudReq("POST", "/api/storage", JSON.stringify(obj))
        } catch(err) {}
    }
    async clear(){
        try{
            await this.cloudReq("DELETE", "/api/storage")
        } catch(err) {  }
    }
    async ping(){
        await this.cloudReq("GET", "/api/ping")
    }
    async setApiKey(email, seed){
        let toHash = bin.concatAB(seed, bin.str2ab(email))
        let hash = bin.toB64URL(bin.ab2str(await crypto.subtle.digest("SHA-256", toHash)))
        await this.cloudReq("POST", "/api/key/"+hash)
    }
}

const passwordNamespace = "pw//"
export class SecureStorage {
    constructor(localStorage){
        this.localStorage = localStorage
        this.cloudStorage = null
        this.localOnly = ["logs", "__apiKey__", "__seed__"]
        this.encrypt = true
        this.cloudCacheTimes = {}
        this.logs = []
        this.seed = null
        this.unlocked = false
    }

    // #region underlying storage interface
    
    async localGet(key){
        let keyE = await this.#hashKey(key)
        let lvalE = await this.localStorage.get(keyE)
        try{
            let lval = lvalE == null ? null : await encrypted2Data(lvalE, this.seed)
            return lval
        } catch(err) {
            console.error("Could not decrypt local storage", "get", key, )
            return null
        }
    }

    /**
     * 
     * @param {*} key 
     * @param {*} maxAge if -1: never cloud fetch; if 0: always cloud fetch; if greater than 0:
     * only fetch if the object in the local storage is older than maxage
     * @returns 
     */
    async get(key, maxAge=0){
        // if(this.pin == null){ throw errNotUnlocked }
        let keyE = await this.#hashKey(key)
        let lvalE = await this.localStorage.get(keyE)
        let lval = null
        try{
            lval = lvalE == null ? null : this.encrypt ? await encrypted2Data(lvalE, this.seed) : lvalE
        } catch(err) {
            console.error("Could not decrypt local storage", "get", key, )
        }

        let cvalE
        let cval = null
        if(!this.localOnly.includes(key) && this.cloudStorage != null){
            let potentialCachedObj = this.cloudCacheTimes[keyE]
            let shouldFetch = maxAge == 0
                || potentialCachedObj === undefined 
                || (potentialCachedObj.setAt+maxAge) < Date.now()
            if(maxAge!=-1 && shouldFetch){
                
                cvalE = await this.cloudStorage.get(keyE)
                if(cvalE != null){
                    try{
                        cval = this.encrypt ? await encrypted2Data(cvalE, this.seed) : cvalE
                        await this.localStorage.set(keyE, cvalE)
                        if(maxAge>0){
                            this.cloudCacheTimes[keyE] = { setAt: Date.now(), ttl: Date.now()+maxAge }
                        }
                    } catch(err) {
                        console.error("Could not decrypt cloud storage", "get", key )
                    }
                }
            }
        }
        if(cval != null){ return cval}
        return lval
    }
    async set(key, value, maxAge=0){
        // if(this.pin == null){ throw errNotUnlocked }
        if(await this.get(key) == value){ 
            return
        }

        let keyE = await this.#hashKey(key)
        let valE = this.encrypt ? await data2Encrypted(value, this.seed) : value
        await this.localStorage.set(keyE, valE)
        if(this.cloudStorage != null && !this.localOnly.includes(key)){
            await this.cloudStorage.set(keyE, valE)
            if(maxAge>0){
                this.cloudCacheTimes[keyE] = { setAt: Date.now(), ttl: Date.now()+maxAge }
            }
        }
    }
    async #deleteAll(keys){
        // if(this.pin == null){ throw errNotUnlocked }

        let keysE = await Promise.all(keys.map(x => this.#hashKey(x)))
        await this.localStorage.deleteAll(keysE)
        if(this.cloudStorage != null){
            for(let keyE of keysE) { delete this.cloudCacheTimes[keyE]}
            await this.cloudStorage.deleteAll(keysE)
        }
    }

    /**
     * returns a map of hashedKeys -> decrypted values
     * @param {*} keys 
     * @param {*} maxAgeFn 
     * @returns 
     */
    async #getAll(keys, maxAgeFn=(x)=>0){
        // if(this.pin == null){ throw errNotUnlocked }

        let keysE = await Promise.all(keys.map(x => this.#hashKey(x)))
        let ldataE = await this.localStorage.getAll(keysE)
        let ckeysE = keysE.filter(x => maxAgeFn(x) !=-1 && (this.cloudCacheTimes[x] === undefined || this.cloudCacheTimes[x].setAt + maxAgeFn(x)>Date.now()))
        let cdataE = this.cloudStorage != null ? await this.cloudStorage.getAll(ckeysE) : {}
        let dataE = {...cdataE, ...ldataE}
        let data
        if(this.encrypt){
            data = {}
            for(let [keyE, valE] of Object.entries(dataE)){
                try{
                    let val = await encrypted2Data(valE, this.seed)
                    data[keyE] = val
                } catch(err) {
                    let storageType = keyE in cdataE ? "cloud" : "local"
                    console.error("could not decrypt "+storageType+" storage", "getAll", keys, err)
                }
            }
        } else {
            data = dataE
        }
        
        for(let i in keys){
            if(maxAgeFn(i) == -1){ continue }
            let key = keys[i]
            let keyE = keysE[i]
            this.cloudCacheTimes[keyE] = { setAt: Date.now(), ttl: Date.now()+maxAgeFn(key) }
        }
        return data
    }
    async setAdd(listKey, el){
        let listVal = await this.get(listKey)
        if(listVal == null){
            listVal = [] 
        } else {
            listVal = JSON.parse(listVal)
        }
        if (listVal.includes(el)){
            return
        }

        listVal.push(el)
        await this.set(listKey, JSON.stringify(listVal))
    }
    async setDel(listKey, el){
        let listVal = await this.get(listKey)
        if(listVal == null){
            return 
        } else {
            listVal = JSON.parse(listVal)
        }
        listVal = listVal.filter(x => x != el)
        await this.set(listKey, JSON.stringify(listVal))
    }
    // #endregion

    async unlock(pin){
        if(pin == null){
            this.seed=await this.localStorage.get("__seed__")
            return
        }
        let pinBuf = await crypto.subtle.digest("SHA-256", bin.str2ab(pin))
        let seedE = await this.localStorage.get("__seed__")
        
        if(seedE == null){
            return false
        }
        let b64hash = await encrypted2Data(seedE, pinBuf)
        if(b64hash == null){ return null }
        this.seed = bin.str2ab(bin.fromB64URL(b64hash))

        let apiKey = await this.getApiKey()
        if(apiKey != null){
            this.cloudStorage = new CloudStorage(apiKey)
        }
        this.unlocked = true
    }

    async saveSeed(plainTextSeed, seedStrength, pin){
        let apiKey = await this.getApiKey()
        if(apiKey!=null){
            // API key is the only key that could be set prior to the seed
            this.localStorage.deleteAll(["__apiKey__"])
        }
        let hash = await crypto.subtle.digest("SHA-256", bin.str2ab(plainTextSeed))
        let b64hash = bin.toB64URL(bin.ab2str(hash))
        this.seed = hash
        await this.saveSetting("seedStrength", seedStrength)
        
        pin = this.pin || pin
        if(pin !==undefined && pin != null){
            this.pin = pin
            let pinBuf = await crypto.subtle.digest("SHA-256", bin.str2ab(pin))
            let seedE = await data2Encrypted(b64hash, pinBuf)
            await this.localStorage.set("__seed__", seedE)
        } else {
            await this.localStorage.set("__seed__", b64hash)
        }

        await this.deleteAllKeys()
        await this.deleteAllPasswords()
        await this.localStorage.set("__seeded__", true)
        this.unlocked = true

        if(apiKey!=null){
            if(this.cloudStorage != null){
                this.cloudStorage.clear()
            }
            this.cloudStorage = new CloudStorage(apiKey)
            this.saveApiKey(apiKey)
            await this.cloudSync()
        }
    }

    async isSeeded(){
        return await this.localStorage.get("__seeded__") === true
    }

    async isUnlocked(){
        return this.unlocked
    }

    // returns bin
    async getSeed(){
        return this.seed //await this.localStorage.get("__seed__")
    }
    async getSeedArray(){
        return this.seed == null ? null : Array.from(new Uint8Array(this.seed))
    }

    async saveApiKey(apiKey, email){
        await this.set("__apiKey__", apiKey)
        if(apiKey == null){
            this.cloudStorage = null
            return
        }
        if(await this.getSeed() != null){
            this.cloudStorage = new CloudStorage(apiKey)
            await this.cloudStorage.ping()
            await this.cloudSync()
            if(email !==undefined && email != null){
                this.cloudStorage.setApiKey(email,this.seed)
            }
        } else {
            console.log("Seed not set yet: saving api key in clear")
        }
    }
    async getApiKey(){ return await this.localGet("__apiKey__")}

    // #region: cloud ops
    
    /**
     * As a cloud specific operation, it throwa an exception if cloud is not connected
     * @returns 
     */
    async cloudSync(){
        if(this.cloudStorage == null){ return }

        let cloudAllStorage = await this.cloudStorage.getAllStorage()
        let localAllStorage = await this.exportStorage()
        let allStorage = {
            ...cloudAllStorage,
            ...localAllStorage,
        }
        
        if(!await this.cloudIsConnected()){
            throw new Error("Cloud is not connected")
        }
        await this.importStorage(allStorage)
    }

    async cloudClear(){
        if(this.cloudStorage == null){ return }
        await this.cloudStorage.clear()
    }

    async cloudPing(){
        if(this.cloudStorage == null){ return false }
        return await this.cloudStorage.ping()
    }

    async cloudIsConnected(){
        if(this.cloudStorage == null){ return false }
        return this.cloudStorage.connected
    }
    // #endregion

    async saveSetting(key, value){
        await this.set("setting---"+key, JSON.stringify({v:value}), 1000 * 60 * 60)
    }
    async getSetting(key, def){
        let s = await this.get("setting---"+key, -1)
        if(s==null && typeof def != undefined){
            return def
        }
        return JSON.parse(s).v
    }

    // #region private keys
    async getKey(rpId, username){
        let rpObjstr = await this.get(rpId)
        if(rpObjstr == null){ return [null, null]}

        let rpObj = JSON.parse(rpObjstr)
        if(!(username in rpObj)){ return [null, null]}

        let keyObj = rpObj[username]
        return keyObj
    }

    async storeKey(rp, user, attestationFmt, credId){
        let existingO = await this.get(rp.id)
        let existing = existingO == null ? {} : JSON.parse(existingO)
    
        existing[user.name] = {
            "user": user,
            "rp": rp,
            "attestationFmt": attestationFmt,
            "counter": 0,
            "credId": credId
        }
        await this.set(rp.id, JSON.stringify(existing))
        await this.setAdd(allKeysKey, rp.id)
    }

    async deleteKey(rpId, username){
        let rpObjstr = await this.get(rpId)
        if(rpObjstr == null){ return}

        let rpObj = JSON.parse(rpObjstr)
        if(!(username in rpObj)){ return }

        delete rpObj[username]

        if(Object.entries(rpObj).length > 0){
            await this.set(rpId, JSON.stringify(rpObj))
        } else {
            await this.#deleteAll([rpId])
            await this.setDel(allKeysKey, rpId)
        }
    }
    
    async getAllKeys(){
        let allKeys = await this.get(allKeysKey)
        if(allKeys == null){ return []}
        
        let keys = Object.values(await this.#getAll(JSON.parse(allKeys)))
        let byRp = keys.filter(x => x!==undefined).map(x => JSON.parse(x))
        return byRp.map(x => Object.values(x)).flat()
    }

    async getAllRpKeys(rpId){
        let rpObjStr = await this.get(rpId)
        if(rpObjStr == null){ return []}

        let rpObj = JSON.parse(rpObjStr)
        return Object.values(rpObj)
    }

    async  deleteAllKeys(){
        let allKeyStr = await this.get(allKeysKey)
        if(allKeyStr == null){ return }
        let allKeys = JSON.parse(allKeyStr)
    
        allKeys.push(allKeysKey)
        await this.#deleteAll(allKeys)
    }

    async incrKey(rpId, username){
        let rpObjStr = await this.get(rpId)
        if(rpObjStr == null){ return }

        let rpObj = JSON.parse(rpObjStr)
        if(!(username in rpObj)){ return }

        rpObj[username].counter++

        await this.set(rpId, JSON.stringify(rpObj))
    }
    // #endregion

    // #region passwords

    async  getPassword(domain, username){
        let domainObjstr = await this.get(passwordNamespace + domain)
        if(domainObjstr == null){ return null}

        let domainObj = JSON.parse(domainObjstr)
        if(!(username in domainObj)){ return null}

        let pwObj = domainObj[username]
        return pwObj.salt
    }

    async  storePassword(domain, username, salt){
        let existingO = await this.get(passwordNamespace + domain)
        let existing = existingO == null ? {} : JSON.parse(existingO)
    
        existing[username] = {
            "username": username,
            "domain": domain,
            "salt": salt,
        }
        await this.set(passwordNamespace + domain, JSON.stringify(existing))
        await this.setAdd(allKeysPwKey, passwordNamespace + domain)
    }

    async  deletePassword(domain, username){
        let domainObjstr = await this.get(passwordNamespace + domain)
        if(domainObjstr == null){ return }

        let domainObj = JSON.parse(domainObjstr)
        if(!(username in domainObj)){ return }

        delete domainObj[username]

        if(Object.entries(domainObj).length > 0){
            await this.set(passwordNamespace + domain, JSON.stringify(domainObj))
        } else {
            await this.#deleteAll([passwordNamespace + domain])
            await this.setDel(allKeysPwKey, passwordNamespace + domain)
        }
    }

    async getAllPasswords(){
        let allPwKeys = await this.get(allKeysPwKey)
        if(allPwKeys == null || allPwKeys == ""){ return []}

        let allPw = Object.values(await this.#getAll(JSON.parse(allPwKeys)))
        let byRp = allPw.map(x => JSON.parse(x))
        return byRp.map(x => Object.values(x)).flat()
    }

    async getAllDomainPasswords(domain){
        let domainObjStr = await this.get(passwordNamespace + domain)
        if(domainObjStr == null){ return []}

        let domainObj = JSON.parse(domainObjStr)
        return Object.values(domainObj)
    }

    async  deleteAllPasswords(){
        let allKeys = JSON.parse(await this.get(allKeysPwKey))
        if(allKeys == null){ return }
    
        allKeys.push(allKeysPwKey)
        await this.#deleteAll(allKeys)
    }
    // #endregion

    async exportStorage(...except){
        let allStorage = await this.localStorage.getAllStorage()
        except = [...except, ...this.localOnly]
        for(let ex of except){
            delete allStorage[await this.#hashKey(ex)]
        }
        return allStorage
    }

    async importStorage(obj){
        await this.localStorage.setAllStorage(obj)
        if(this.cloudStorage != null){
            await this.cloudStorage.setAllStorage(obj)
        }
    }

    async  #hashKey(key){
        if(!this.encrypt){ return key}
        let toHash = bin.concatAB(this.seed, bin.str2ab(key))
        return bin.toB64URL(bin.ab2str(await crypto.subtle.digest("SHA-256", toHash)))
    }

    pushLog(log){ this.logs.push(log) }
    getLogs(){  return this.logs }

    async sourceApiKey(email){
        let toHash = bin.concatAB(this.seed, bin.str2ab(email))
        let hash = bin.toB64URL(bin.ab2str(await crypto.subtle.digest("SHA-256", toHash)))
        let response = await cloudReq("", "GET", "/apiKey/"+hash)
        if(response.status == 404){ return false }
                
        let apiKey = await response.text()
        this.saveApiKey(apiKey)
        return true
    }
}