"use strict"

import { setSeedUX } from "./setSeed.js"
import { genericEventHandling, activateCard } from "./common.js"
import * as prompt from "../lib/prompt.js"
import { setPinUX } from "./setPin.js"

let theme=new URLSearchParams(window.location.search).get('theme')
document.getElementById("theme").setAttribute("href", "/style/"+theme)
document.addEventListener("click", prompt.ping)
document.addEventListener("keyDown", prompt.ping)

document.addEventListener("DOMContentLoaded",async function(){
    genericEventHandling()
    let seed
    let pin

    prompt.getInitData((r) => {
        document.getElementById("rpId").innerText = r.rpId
        document.getElementById("username").innerText = r.username
        
        if(r.setSeed){
            let card = setSeedUX(
                document.getElementById("register-card-wrapper"),
                async function(s,p){
                    seed = s
                    pin = p
                    activateCard(document.getElementById("register-card"))
                },
                true)
            activateCard(card)
        } else if (r.setPin){
            let card = setPinUX(
                document.getElementById("register-card-wrapper"),
                (p) => { 
                    pin = p
                    activateCard(document.getElementById("register-card"))
                },
                true
            )
            activateCard(card)
            console.log(card.querySelector("input"))
            card.querySelector("input").focus({preventScroll:true})
        }
    })

    document.getElementById("acceptBtn").addEventListener("click", async ()=>{
        await prompt.complete({result:"accept", seed: seed, pin: pin});
    })
    document.getElementById("declineBtn").addEventListener("click", async ()=>{
        await prompt.complete({result:"decline", seed: seed, pin: pin});
    })
    document.getElementById("nativeBtn").addEventListener("click", async ()=>{
        await prompt.complete({result:"native", seed: seed, pin: pin});
    })
})