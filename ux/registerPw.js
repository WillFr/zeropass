import { activateCard, genericEventHandling } from "./common.js";
import { setSeedUX } from "./setSeed.js"
import { setPinUX } from "./setPin.js";
import * as prompt from "../lib/prompt.js"


let theme=new URLSearchParams(window.location.search).get('theme')
document.getElementById("theme").setAttribute("href", "/style/"+theme)
document.addEventListener("click", prompt.ping)
document.addEventListener("keyDown", prompt.ping)

document.addEventListener("DOMContentLoaded",async function(){
    genericEventHandling()

    let usernameInput = document.getElementById("username")
    let saltInput = document.getElementById("salt")

    prompt.getInitData(async (r)=>{
        var seed
        var pin
        usernameInput.value = r.username
        usernameInput.focus({preventScroll:true})
        if(r.setSeed){
            let card = setSeedUX(
                document.getElementById("main-card-wrapper"),
                async function(s, p){
                    seed = s
                    pin = p   
                    activateCard(document.getElementById("card-registerUn"))
                },
                true)
            activateCard(card)
        } else if (r.setPin){
            let card = setPinUX(
                document.getElementById("main-card-wrapper"),
                (p) => { 
                    pin = p
                    activateCard(document.getElementById("card-registerUn"))
                },
                true
            )
            activateCard(card)
        }

        document.getElementById("rpId").innerText = r.rpId
        document.getElementById("submit").addEventListener("click", async () => {
            await prompt.complete({
                salt: saltInput.value,
                username: usernameInput.value,
                seed: seed,
                pin: pin
            });
        })
    })  
})