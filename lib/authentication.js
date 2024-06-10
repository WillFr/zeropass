"use strict"

import { SecureStorage } from "./storage.js"
import * as binary from "./binary.js"
import * as cryptolib from "./crypto.js"
import * as webauthn from "./webauthn.js"
import { promptPopup } from "./prompt.js"
import { keyAlgo } from "./util.js"
import { globalCache } from "./cache.js"
import { signAlgo } from "./util.js"

export async function handleOnGetRequestPassword(sendResponse, ss, domain){
        let pws = await ss.isUnlocked() ? await ss.getAllDomainPasswords(domain) : []
        let getData = await ss.isUnlocked() ? () => {} : async function(d){
            await ss.unlock(d.pin)
            return await ss.getAllDomainPasswords(domain)
        }
        let result = await promptPopup(
          "pages/authenticatePw.html",
          crypto.randomUUID(),
          async function(){ return { 
            rpId: domain,
            passwords: pws,
            setSeed: !await ss.isSeeded(), 
            setPin: !await ss.isUnlocked()
          }},
          220,
          ss,
          getData)
        if(!await ss.isSeeded()){  await ss.saveSeed(result.seed, 0, result.pin) }    
        let pw = await cryptolib.toPassword(domain, result.username, result.salt, await ss.getSeed())
        sendResponse({username: result.username, password: pw})
}
/**
 * handles an authentication request for passkey
 * @param {object} requestInfo
 * @param {SecureStorage} ss
 */
export async function handleOnGetRequest(requestInfo, ss){
    let requestDetail = JSON.parse(requestInfo.requestDetailsJson)
    let allowedCredId = requestDetail.allowCredentials.map(x => x.id)
   
    let currentTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
    let storedKeys = await ss.getAllRpKeys(requestDetail.rpId)
    let cacheKey = currentTab.id + "execute"
    let result
    if(cacheKey in globalCache.data && storedKeys.some(x => x.user.displayName==globalCache.get(cacheKey).username)){
        // This is for discoverable cred
        result = { username: globalCache.get(cacheKey).username}
    } else {
        let ssUnlocked = await ss.isUnlocked()
        let getUsernames = async function(){
            let usernames = []
            storedKeys = storedKeys.filter(x => allowedCredId.length == 0 || allowedCredId.includes(x.credId))
            if(storedKeys != null){
                usernames = storedKeys.map(x => x.user.displayName)
            }
            return usernames
        }
        let usernames = ssUnlocked ? await getUsernames() : []
        let getData = ssUnlocked ? () => {} :  async function(d){
            await ss.unlock(d.pin)
            let usernames = await getUsernames()
            return usernames
        }

        result = await promptPopup(
            "pages/authenticate.html",
            requestInfo.requestId,
            async function(){ return { 
                rpId: requestDetail.rpId, 
                usernames: usernames, 
                setSeed: !await ss.isSeeded(),
                setPin: !ssUnlocked
            }},
            250, 
            ss,
            getData)
        if(!await ss.isSeeded()){
            await ss.saveSeed(
                result.seed || globalCache.get("__tmp_seed__"),
                0,
                result.pin)
        }
    }
    if (result.username != "Use native Chrome") { // that is the selected username
        try{
            let getResponse = await execute(ss, await ss.getSeed(), requestInfo, requestDetail, result.username)
            return chrome.webAuthenticationProxy.completeGetRequest(getResponse)
        } catch(err) {
            console.error(err)
            let getResponse = {
                "requestId": requestInfo.requestId,
                "error": {"name": "Unexpected", "message": err.toString()}
            }
            return chrome.webAuthenticationProxy.completeGetRequest(getResponse)
        }
    } else if (result.username == "Use native Chrome") {
        detachProxy()
        blockDomain(currentTab.url)
    } else {
        let getResponse = {
            "requestId": requestInfo.requestId,
            "error": {"name": "User cancelled", "message": "Request cancelled by the user"}
        }
        return chrome.webAuthenticationProxy.completeGetRequest(getResponse)
    }
}

const recoveredCredId = binary.toB64URL(binary.ab2str(new Uint8Array(20)))
/**
 * @param {SecureStorage} ss
 */
async function execute(ss, seed, requestInfo, requestDetail, username){
    let rpId = requestDetail.rpId

    let currentTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
    let currentTabUrl = currentTab === undefined ? "" : new URL(currentTab.url)
    if(currentTabUrl.protocol!="https:"){
        return errorOut(requestInfo.requestId, new Error("Zero pass works only on HTTPS ("+currentTabUrl.protocol+")"))
    }
    if(currentTabUrl.host!=rpId && !currentTabUrl.host.endsWith("."+rpId)){
        return errorOut(requestInfo.requestId, new Error("Zero pass works only if the hostname ("+currentTabUrl.host+") matches the rp ID ("+requestDetail.rp.id+")"))
    }

    let keyObj = await ss.getKey(rpId, username)
    if(keyObj.user==null){ 
        // let's recover the passkey based on the RP id
        // this works ONLY if the RP does not use discoverable creds
        // Indeed discoverable creds expect a user handle field 
        // which cannot be reconstructed from the RP id itself, it is
        // given by the RP during registration
        keyObj = {}
        let rp = {
            id: rpId,
            name: "recovered from "+rpId
        }
        let userId = null
        keyObj.attestationFmt = "direct"
        keyObj.user = {
            id: userId,
            displayName: username,
            name: username
        }
        await ss.storeKey(rp, keyObj.user, keyObj.attestationFmt, recoveredCredId)
    }

    
    let seedBuf = binary.concatAB(binary.str2ab(binary.toB64URL(rpId)), seed)
    let currentKey = await cryptolib.GenerateECDSA(
        await cryptolib.seed2D(seedBuf, cryptolib.secp256r1.n-1n),
        cryptolib.secp256r1,
        keyAlgo
    )

    ss.incrKey(rpId, username)

    
    let credIDShort = binary.concatAB(binary.str2ab(requestDetail.rpId), binary.str2ab(username))
    let credID = webauthn.padCredId(credIDShort)

    let credIDStr = binary.toB64URL(binary.ab2str(credID))
    let attestedCredentialData = await webauthn.generateAttestedCredentialData(
        binary.str2ab(webauthn.authAAGUID),
        credID,
        currentKey.publicKey)
    let authData = await webauthn.generateAuthenticatorData(rpId, attestedCredentialData) // TODO: no need for attestedCredentialData in the authentication flow
    
    let clientData = {
        "type":"webauthn.get",
        "challenge":requestDetail.challenge,
        "origin":requestDetail.extensions.remoteDesktopClientOverride.origin,
        "crossOrigin":requestDetail.extensions.remoteDesktopClientOverride.sameOriginWithAncestors
    }
    let clientDataJson = JSON.stringify(clientData)
    let hash = await crypto.subtle.digest("SHA-256", binary.str2ab(clientDataJson))

    let sigRaw = await crypto.subtle.sign(signAlgo, currentKey.privateKey, binary.concatAB(authData,hash))
    let signature = cryptolib.ECDSASigtoDER(sigRaw)
    let attestationObject = await webauthn.generateAttestationData(keyObj.attestationFmt, clientData, authData, currentKey.privateKey)

    let response = {
        "id": credIDStr,
        "rawId": credIDStr, 
        "response": {
            "clientDataJSON": binary.toB64URL(clientDataJson),
            "authenticatorData": binary.toB64URL(binary.ab2str(authData)),
            "attestationObject": binary.toB64URL(binary.ab2str(attestationObject)),
            "signature": binary.toB64URL(binary.ab2str(signature)),
        },
        "authenticatorAttachment": "cross-platform",
        "clientExtensionResults": {},
        "type": "public-key"
    }

    if(keyObj.user.id != null){
        // this field is optional
        response.response.userHandle = keyObj.user.id
    }

    let getResponse = {
        "requestId": requestInfo.requestId,
        "responseJson": JSON.stringify(response)
    }
    return getResponse
}


function errorOut(reqId, err){
    console.error(err)
    let getResponse = {
        "requestId": reqId,
        "error": {"name": "Unexpected", "message": err.toString()}
    }
    return chrome.webAuthenticationProxy.completeCreateRequest(getResponse)
}