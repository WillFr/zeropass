import {handleOnGetRequest, handleOnGetRequestPassword} from "./lib/authentication.js"
import {handleOnCreateRequest, handleOnCreateRequestPassword} from "./lib/registration.js"
import {hookConsole} from "./lib/hookit.js"
import {attachProxy, tryAttachProxy} from "./lib/proxy.js"
import { managePasswords } from "./lib/passwordInjection.js"
import * as Storage from "./lib/storage.js"
import { promptPopup } from "./lib/prompt.js"
import * as cryptolib from "./lib/crypto.js"
import { Cache, globalCache } from "./lib/cache.js"
import { handlePromptMessage } from "./lib/prompt.js"

let bs = new Storage.ChromeLocalStorage()
let ss = new Storage.SecureStorage(bs)

hookConsole(ss)

chrome.runtime.onInstalled.addListener((_reason) => OnInstalled(_reason))

async function OnInstalled(reason){
  chrome.storage.local.clear()
}

attachProxy()

chrome.tabs.onActivated.addListener(async function(activeInfo) {
  tryAttachProxy(ss)
});

// Events
chrome.webAuthenticationProxy.onCreateRequest.addListener((ri) => handleOnCreateRequest(ri, ss))
chrome.webAuthenticationProxy.onGetRequest.addListener((ri) => handleOnGetRequest(ri, ss))
chrome.webAuthenticationProxy.onIsUvpaaRequest.addListener(async ri => {
  let response = {"requestId": ri.requestId, "isUvpaa": true }
  return await chrome.webAuthenticationProxy.completeIsUvpaaRequest(response)
})

chrome.runtime.onMessageExternal.addListener(async function(request, sender, sendResponse) {
  //https://0pass.me/cryptoseed.html?*", "https://www.0pass.me/cryptoseed.html?
  if(sender.url.startsWith("https://0pass.me/cryptoseed.html?extId="+chrome.runtime.id)){
    if(await ss.getSeed() != null){
      let result = await promptPopup(
        "pages/confirm.html", 
        crypto.randomUUID(), 
        { ask: `Are you sure you want to override your current passphrase ?
        It will render all your existing passkeys, passwords, exports, and 
        cloud data unusable.`},
        250,
        ss
      )
      if(result.result!="accept"){
        sendResponse("There was a problem")
        return
      }
    }
    globalCache.data["__tmp_seed__"]={val: request.seed, ttl: Date.now() + 10000}
    sendResponse("Your pass phrase has been created &#65039;")
  } else if (sender.url.startsWith("https://0pass.me/order/success?") ){
    if(request.msg == "apiKey"){
      await ss.saveApiKey(request.apiKey, request.email)
      sendResponse({status: "saved"})
    }
  } else {
    sendResponse("An error occured")
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  const domain = (new URL(sender.origin)).hostname
  if(request.id=="authenticatePw"){
    handleOnGetRequestPassword(sendResponse, ss, domain)
    return true
  } else if (request.id == "registerPw") {
    handleOnCreateRequestPassword(sendResponse, ss, domain, request.username)
    return true
  } else if (request.id == "webauthn") {
    (async function(){
      let rpId = domain
      let storedKeys = await ss.getAllRpKeys(rpId)
      let usernames = []
      if(storedKeys != null){
        usernames = storedKeys.map(x => x.user.name)
      }
      let result = await promptPopup(
        "pages/authenticate.html",
        crypto.randomUUID(),
        async function(){ return { rpId: rpId, usernames: usernames, setSeed: !await ss.isSeeded()}},
        130 + usernames.length * 20,
        ss)
      if(!await ss.isSeeded()){  await ss.saveSeed(result.seed, 0, result.pin) }
      globalCache.set(sender.tab.id+"execute", { username: result.username}, 1000*60 )
      sendResponse({username: result.username})
    })()
    return true
  } else if (request.id == "storageAdapter") {
    (async function(){
      try{
        let res = await ss[request.method](...request.args)
        sendResponse(res)
      } catch(err) {
        console.error(err)
        console.trace(err)
        sendResponse({__error__: err.toString(), stack: err.stack})
      }
    })()
    return true
  } else if (request.id == "prompt") {
    (async function(){
      let res = await handlePromptMessage(request, sender)
      sendResponse(res)
    })()
    return true
  } else if (request.id == "getTempSeed") {
    sendResponse(globalCache.get("__tmp_seed__"))
  } else if (request.id == "resetStorage"){
    bs = new Storage.ChromeLocalStorage()
    ss = new Storage.SecureStorage(bs)
  }
})
 
 

chrome.webAuthenticationProxy.onRemoteSessionStateChange.addListener(
  function(request, sender, sendResponse) {
      console.log("REMOTE SESSION STATE CHANGE", request)
  }
)

chrome.webAuthenticationProxy.onRequestCanceled.addListener(
  function(requestId){
    // TODO : this fires if notifications are not allowed
    console.log("request cancelled", requestId)
  }
)

let currentTabId = 0
let currentTabEvents = []
let webNavigationTimeout = null
let webNavigationHandler = async function(d){
  let tabId = d.tabId
  if(tabId != currentTabId){
    currentTabId = tabId
    currentTabEvents = []
  }
  
  if(webNavigationTimeout != null){
    clearTimeout(webNavigationTimeout)
  }

  if(d.url != "about:blank" && !d.url.startsWith("http")){ console.log("early return", d.url); return }

  webNavigationTimeout = setTimeout(async function(){
    currentTabEvents.push(d)
    await chrome.scripting.executeScript({
      target : {tabId : tabId},
      func : managePasswords,
      args: [ chrome.runtime.id, currentTabEvents ]
    })
  }, 3000) // the timeout is necessary since specific page dynamically create the dom
  // TODO: replace with a dom monitor
}

// to enable the following, add to the manifest : 
//  "optional_permissions": [
//   "webNavigation",
//   "scripting",
// ],
// "host_permissions": [
//   "http://*/*",
//   "https://*/*"
// ],
// let webNavigationInterval = setInterval(async () => {
//   if(await chrome.permissions.contains({permissions: ['webNavigation']})) {
//     chrome.webNavigation.onCompleted.addListener(webNavigationHandler)
//     clearInterval(webNavigationInterval)
//   }
// }, 1000)


