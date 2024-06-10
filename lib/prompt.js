"use strict"

const inactiveTimeout = 30000

var handleMsg
export async function promptPopup(url, id, initData, height, ss, onGetData) { 
    if(typeof height == undefined){
        height = 0
    }
    height = Math.max(height, 350)
    let existingPopup = await chrome.windows.getAll({windowTypes:["popup"]})
    existingPopup.forEach((x)=> {try{ chrome.windows.remove(x.id)}catch(e){}})
    let init = false
    let result = false
    let completed = false
    let closeTimeout = null
    let popup = null
    let closeHandler = async ()=>{ await tryCloseWindow(popup.id)}
    
    handleMsg = async function(request, sender) {
        let shouldStartWith = "chrome-extension://"+chrome.runtime.id+"/"+url+"?id="+id+"&"
        if(sender.id != chrome.runtime.id || !sender.url.startsWith(shouldStartWith)){
            if(sender.id != chrome.runtime.id){ console.log("wrong sender", request, sender,sender.id + " != " +chrome.runtime.id)}
            if(!sender.url.startsWith(shouldStartWith)){console.log("wrong url", sender.url + " not startswith "+ shouldStartWith )}
            
            return
        }
        if(request.msg == "ping"){
            clearTimeout(closeTimeout)
            closeTimeout = setTimeout(closeHandler, inactiveTimeout)
        }else if(request.msg =="init"){
            let resp = typeof initData === 'function' ? await initData() : initData
            init=true
            return resp
        } else if (request.msg == "complete") {
            chrome.windows.remove(popup.id)
            completed=true
            result = request
        } else if (request.msg == "getData") {
            return await onGetData(request.data)
        }
    }
    
    let width = 365
    let window = await chrome.windows.getCurrent()
    let left =Math.floor((window.width/2)-(width/2)) + window.left
    let top =Math.floor((window.height/3)-(width/2)) + window.top

    
    popup = await chrome.windows.create(
        {
            focused: true,
            height: height,
            width:width,
            type: "popup",
            url: url+"?id="+id+"&theme="+ (ss != null ? await ss.getSetting("theme", "popup_ocean.css") : "popup_ocean.css"),
            left:left,
            top:top
        }
    )

    closeTimeout = setTimeout(closeHandler, inactiveTimeout)

    await waitState(()=>completed)

    clearTimeout(closeTimeout)
    handleMsg = function(a,b){return null}
    
    return result
}

export async function handlePromptMessage(request, sender){
    return await handleMsg(request, sender)
}

export async function getInitData(fn){
    return chrome.runtime.sendMessage({id: "prompt", msg: "init" }, fn)
}

export async function getData(d, fn){
    return chrome.runtime.sendMessage({id: "prompt", msg: "getData", data: d }, fn)
}

export async function ping(){
    chrome.runtime.sendMessage({id: "prompt", msg: "ping" })
}

export async function complete(data, fn){
    chrome.runtime.sendMessage({id: "prompt", msg: "complete", ...data}, fn)
}

async function waitState(fn) {
    return new Promise(resolve => {
      let timerId = setInterval(checkState, 1000);
    
      function checkState() {
        if (fn()) {
          clearInterval(timerId);
          resolve(true);
        }
      }
    });
}

async function tryCloseWindow(id){
    let exist = await chrome.tabs.query({ windowId: id})
    if(exist.length>0){
        chrome.windows.remove(id)
    } 
}