import { genericEventHandling } from "./common.js";
import * as prompt from "../lib/prompt.js"

let theme=new URLSearchParams(window.location.search).get('theme')
document.getElementById("theme").setAttribute("href", "/style/"+theme)
document.addEventListener("click", prompt.ping)
document.addEventListener("keyDown", prompt.ping)

document.addEventListener("DOMContentLoaded",async function(){
    genericEventHandling()

    document.getElementById("pinBtnOk").addEventListener("click", async ()=>{
        await prompt.complete({
            id: "prompt", 
            pin: document.getElementById("pinInput").value
        });
    })

    prompt.getInitData((r)=>{})
})