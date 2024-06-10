import { genericEventHandling, activateCard } from "./common.js";
import { setSeedUX } from "./setSeed.js"
import { setPinUX } from "./setPin.js"
import * as prompt from "../lib/prompt.js"

let theme=new URLSearchParams(window.location.search).get('theme')
document.getElementById("theme").setAttribute("href", "/style/"+theme)
document.addEventListener("click", prompt.ping)
document.addEventListener("keyDown", prompt.ping)

var seed
var pin

let selectHandler = async (e)=>{
    await prompt.complete({
        username:e.target.innerText,
        seed: seed,
        pin: pin
    });
}

function populateUsernames(usernames){
    let unList=document.getElementById("usernames")
    usernames.push("Use native Chrome")
    usernames.forEach(x => {
        let li = document.createElement("li")
        let btn = document.createElement("div")
        btn.classList.add("button")
        btn.innerText = x
        btn.addEventListener("click", selectHandler)
        li.appendChild(btn)
        unList.appendChild(li)
    });
}
document.addEventListener("DOMContentLoaded",async function(){

    genericEventHandling()

    document.getElementById("recoverUsernameOk").addEventListener("click", async ()=>{
        await prompt.complete({
            username: document.getElementById("recoverUsername").value,
            attestation: document.getElementById("recoverAttest").value,
            seed: seed,
            pin: pin
        });
    })
 
    prompt.getInitData((r)=>{
        document.getElementById("rpId").innerText = r.rpId
        if(r.setSeed){
            let card = setSeedUX(
                document.getElementById("main-card-wrapper"),
                async function(s,p){
                    seed = s
                    pin = p
                    activateCard(document.getElementById("authenticate-card"))
                },
                true)
            activateCard(card)
        } else if(r.setPin){
            let card = setPinUX(
                document.getElementById("main-card-wrapper"),
                async (p) => { 
                    await prompt.getData({pin: p}, x => { populateUsernames(x) })
                    activateCard(document.getElementById("authenticate-card"))
                },
                true
            )
            activateCard(card)
        } else {
            populateUsernames(r.usernames)
        }
    })
})