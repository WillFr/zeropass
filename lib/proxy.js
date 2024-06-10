"use strict";

import { SecureStorage } from "./storage.js";

let attached = false
export function attachProxy(){
  chrome.webAuthenticationProxy.attach(function(error){
    if(error != undefined && error != null){
      console.log("Could not attach the web auth proxy", error)
    } else {
      attached = true
    }
  })
}

export function detachProxy(){
  chrome.webAuthenticationProxy.detach(function(error){
    if(error != undefined && error != null){
      console.log("Could not detach the web auth proxy", error)
    } else {
      attached = false
    }
  })
}

/**
 * @param {SecureStorage} ss 
 * @param {string} urlStr 
 */
export async function blockDomain(ss, urlStr){
    if(urlStr == "" ){ return }
    let domain = (new URL(urlStr)).hostname
    await ss.setAdd("disabledDomains", domain)
}

/**
 * @param {SecureStorage} ss 
 * @param {string} domain 
 */
export async function enableDomain(ss, domain){
    await ss.setDel("disabledDomains", domain)
    
    let currentTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
    let url = new URL(currentTab.url)
    if(url == "") { return }
    let curDomain = url.hostname
    if(curDomain == domain){
        attachProxy()
    }
}

/**
 * @param {SecureStorage} ss
 */
export async function tryAttachProxy(ss){
    let tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    let tab = tabs[0];
    if(tab === undefined || tab.url == "" ){ return }
    let domain = (new URL(tab.url)).hostname
    let disabledDomains = await getDisabledDomain(ss)
    if(attached && disabledDomains.includes(domain)){
        detachProxy()
    } else if (!attached){
        attachProxy()
    }
}

/**
 * @param {SecureStorage} ss 
 */
export async function getDisabledDomain(ss){
  let disabledDomains = JSON.parse(await ss.get("disabledDomains") || "[]")
  return disabledDomains
}
