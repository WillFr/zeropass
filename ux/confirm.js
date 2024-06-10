"use strict"

import { genericEventHandling } from "./common.js"
import * as prompt from "../lib/prompt.js"

let theme=new URLSearchParams(window.location.search).get('theme')
document.getElementById("theme").setAttribute("href", "/style/"+theme)
document.addEventListener("click", prompt.ping)
document.addEventListener("keyDown", prompt.ping)

document.addEventListener("DOMContentLoaded",async function(){
    genericEventHandling()

    prompt.getInitData((r)=>{
        document.getElementById("ask").innerText = r.ask
    })

    document.getElementById("confirm").addEventListener("click", async ()=>{
        await prompt.complete({result:"accept"});
    })
    document.getElementById("cancel").addEventListener("click", async ()=>{
        await prompt.complete({result:"decline"});
    })
})