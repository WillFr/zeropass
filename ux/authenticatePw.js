import { genericEventHandling } from "./common.js";
import { setSeedUX } from "./setSeed.js"
import * as prompt from "../lib/prompt.js"

let theme=new URLSearchParams(window.location.search).get('theme')
document.getElementById("theme").setAttribute("href", "/style/"+theme)
document.addEventListener("click", prompt.ping)
document.addEventListener("keyDown", prompt.ping)

document.addEventListener("DOMContentLoaded",async function(){
    var seed
    var pin

    genericEventHandling()

    let selectHandler = async (e, x)=>{
        await prompt.complete({...x, seed: seed, pin: pin})
    }
    prompt.getInitData((r)=>{
        if(r.setSeed){
            let card = setSeedUX(
                document.getElementById("main-card-wrapper"),
                async function(s, p){
                    seed = s
                    pin = p
                    document.getElementById("authenticate-card").dispatchEvent(new Event("activate", {bubbles:true}))
                },
                true)
            card.dispatchEvent(new Event("activate", {bubbles: true}))
        } 

        document.getElementById("rpId").innerText = r.rpId
        let unList=document.getElementById("usernames")

        r.passwords.forEach(x => {
            let li = document.createElement("li")
            let btn = document.createElement("div")
            btn.classList.add("button")
            btn.innerText = x.username
            btn.addEventListener("click", function(e){ selectHandler(e, x)})
            li.appendChild(btn)
            unList.appendChild(li)
        });

        document.getElementById("generatePassword").addEventListener("click", async ()=>{
            let salt = document.getElementById("salt").value
            let username = document.getElementById("recoverUsername").value
            await prompt.complete({id: "prompt", username:username, salt:salt, seed: seed, pin:pin});
        })
    })

})