"use strict"

import { SecureStorage } from "./storage.js"
import * as binary from "./binary.js"
import * as cryptolib from "./crypto.js"
import * as proxy from "./proxy.js"
import { promptPopup } from "./prompt.js"
import { getSeedStrengthLevel, keyAlgo } from "./util.js"
import * as webauthn from "./webauthn.js"
import { globalCache } from "./cache.js"

export async function handleOnCreateRequestPassword(sendResponse, ss, domain, username){
    let result = await promptPopup(
        "pages/registerPw.html",
        crypto.randomUUID(),
        async function(){ return {
            username: username,
            rpId: domain,
            setSeed: !await ss.isSeeded(),
            setPin: !await ss.isUnlocked()
        }},
        220,
        ss)
    if(!await ss.isSeeded()){  await ss.saveSeed(result.seed, 0, result.pin) }
    else if(!await ss.isUnlocked()){ await ss.unlock(result.pin)}
    await ss.storePassword(domain, result.username, result.salt)
    let pw = await cryptolib.toPassword(domain, result.username, result.salt, await ss.getSeed())
    sendResponse({password: pw, username: result.username})
}

/**
 * 
 * @param {Object} requestInfo 
 * @param {SecureStorage} ss 
 */
export async function handleOnCreateRequest(requestInfo, ss){
    let requestDetail = JSON.parse(requestInfo.requestDetailsJson)
    
    let currentTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
    let currentTabUrl = new URL(currentTab.url)
    if(currentTabUrl.protocol!="https:"){
        return errorOut(requestInfo.requestId, new Error("Zero pass works only on HTTPS ("+currentTabUrl.protocol+")"))
    }
    if(currentTabUrl.host!=requestDetail.rp.id && !currentTabUrl.host.endsWith("."+requestDetail.rp.id)){
        return errorOut(requestInfo.requestId, new Error("Zero pass works only if the hostname ("+currentTabUrl.host+") matches the rp ID ("+requestDetail.rp.id+")"))
    }
    
    let result = await promptPopup(
        "pages/register.html", 
        requestInfo.requestId, 
        async function(){ return { 
            rpId: requestDetail.rp.id, 
            username: requestDetail.user.displayName,
            setSeed: !(await ss.isSeeded()),
            setPin: !ss.isUnlocked()
        }}, 
        350, 
        ss)
    
    if(!(await ss.isSeeded()) && result.seed != null){
        await ss.saveSeed(
            result.seed || globalCache.get("__tmp_seed__"),
            getSeedStrengthLevel(result.seed),
            result.pin)
    } else if (!ss.isUnlocked()){
        ss.unlock(result.pin)
    }
    if (result.result == "accept") {
        try{
            let [regResponse, onSuccess] = await register(requestInfo, ss)
            let getResponse = {
                "requestId": requestInfo.requestId,
                "responseJson": JSON.stringify(regResponse)
                }
            await chrome.webAuthenticationProxy.completeCreateRequest(getResponse)
            onSuccess()
        } catch(err) {
            return errorOut(requestInfo.requestId, err)
        }
    } else if (result.result == "native") {
        proxy.detachProxy()
        proxy.blockDomain(ss, currentTab.url)
    } else {
        let getResponse = {
            "requestId": requestInfo.requestId,
            "error": {"name": "User cancelled", "message": "Request cancelled by the user"}
        }
        return chrome.webAuthenticationProxy.completeCreateRequest(getResponse)
    }
}

/**
 * @param {Object} requestInfo 
 * @param {SecureStorage} ss 
 */
async function register(requestInfo, ss){
    let requestDetail = JSON.parse(requestInfo.requestDetailsJson)
    let rp = requestDetail.rp
    let user = requestDetail.user
    
    let seed = await ss.getSeed()
    let seedBuf = binary.concatAB(binary.str2ab(binary.toB64URL(rp.id)), seed) // TODO : should we use the username as a part of the seed ?
    let currentKey = await cryptolib.GenerateECDSA(
        await cryptolib.seed2D(seedBuf, cryptolib.secp256r1.n-1n),
        cryptolib.secp256r1,
        keyAlgo
    )

    let clientData = {
        "type":"webauthn.create",
        "challenge":requestDetail.challenge,
        "origin":requestDetail.extensions.remoteDesktopClientOverride.origin,
        "crossOrigin":requestDetail.extensions.remoteDesktopClientOverride.sameOriginWithAncestors
    }
    
    let spkiBuff = await crypto.subtle.exportKey("spki", currentKey.publicKey)
    let credIDShort = binary.concatAB(binary.str2ab(requestDetail.rp.id), binary.str2ab(user.name))
    let credID = webauthn.padCredId(credIDShort)

    let credIDStr = binary.toB64URL(binary.ab2str(credID))
    let attestedCredentialData = await webauthn.generateAttestedCredentialData(binary.str2ab(webauthn.authAAGUID), credID, currentKey.publicKey)
    let authData = await  webauthn.generateAuthenticatorData(requestDetail.rp.id, attestedCredentialData)
    let attestationObject = await  webauthn.generateAttestationData(requestDetail.attestation, clientData, authData, currentKey.privateKey)

    let response = { 
        "id": credIDStr,
        "rawId": credIDStr,
        "response": {
            "clientDataJSON": binary.toB64URL(JSON.stringify(clientData)),
            "authenticatorData": binary.toB64URL(binary.ab2str(authData)),
            "transports": ["usb"],
            "publicKey": binary.toB64URL(binary.ab2str(spkiBuff)),
            "publicKeyAlgorithm": -7,
            "attestationObject": binary.toB64URL(binary.ab2str(attestationObject))
        }, 
        "authenticatorAttachment":  "cross-platform",
        "clientExtensionResults":{}, 
        "type":"public-key"
    }
    
    return [
        response, 
        (async function(){
            await ss.storeKey(rp, user, requestDetail.attestation, credIDStr)
        })]
}

function errorOut(reqId, err){
    console.error(err)
    let getResponse = {
        "requestId": reqId,
        "error": {"name": "Unexpected", "message": err.toString()}
    }
    return chrome.webAuthenticationProxy.completeCreateRequest(getResponse)
}