"use strict"

    // const real_create = navigator.credentials.create.bind(navigator.credentials);

    // navigator.credentials.create = function() {
    // }


export function hookConsole(ss){
    if(typeof window != "undefined"){
        let origConsoleLog = window.console.log
        window.console.log = function(...x){ utilLog(ss, origConsoleLog, '<span class="info">', "</span>", ...x)}
        let origConsoleError = window.console.error
        window.console.error = function(...x){ utilLog(ss, origConsoleError, '<span class="error">', "</span>", ...x)}
    } else {
        let origConsoleLog = console.log
        console.log = function(...x){ utilLog(ss, origConsoleLog,  '<span class="info">', "</span>", ...x)}
        let origConsoleError = console.error
        console.error = function(...x){ utilLog(ss, origConsoleError,  '<span class="error">', "</span>", ...x)}
    }
}

function utilLog(ss, oLog, pref, suff, ...args){
    let strs = args.map(x => {
        if(x instanceof Error){
            return x.toString()
        } else {
            return JSON.stringify(x)
        }
    })
    
    let now = new Date()
    let hou = now.getHours().toString().padStart(2, '0')
    let min = now.getMinutes().toString().padStart(2, '0')
    let sec = now.getSeconds().toString().padStart(2, '0')

    let log = pref + hou+":"+min+":"+ sec + " : " + strs.join(", ") + suff
    ss.pushLog(log)

    oLog(...args)
}