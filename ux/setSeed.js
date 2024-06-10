import { success } from "./common.js"
import { getSeedStrengthLevel } from "../lib/util.js"


let seedStrengthMessages = {
    0: '<span style="color:white"> <span class="emoji"> &#x1F4A1; </span> Think about a memorable sentence</span>',
    1: '<span style="color:orange"> <span class="emoji"> &#x1F61F; </span> We are getting somewhere</span>',
    2: '<span style="color:yellow"> <span class="emoji"> &#x1F60F; </span> Common friend, add a few characters',
    3: '<span style="color:cyan"> <span class="emoji"> &#x1F609; </span> Good, good, not yet great, but good!',
    4: '<span style="color:lightgreen"> <span class="emoji"> &#x1F607; </span> You take security seriously I see !',
    5: '<span style="color:green"> <span class="emoji"> &#x1F60E; </span> Ok, I\'m not complaining anymore',
    6: '<span style="color:pink"> <span class="emoji"> &#x1F60D; </span> where will you stop ?',
    7: '<span style="color:white"> <span class="emoji"> &#x1F607; </span> You are a maniac! '

}

const setSeedHtml = `
<div class="card" id="card-newPin">
    <h3> Pick a pin</h3>
    <p>
    A pin is necessary to encrypt/decrypt the local storage and will be asked every time you restart your browser
    </p>
    <div class="button card-wrapper horizontal">
            <div class="textsubbutton">
                <input type="text" class="pinInput" placeholder="Enter a pin" />
                <div class="cardlink submit" rel="card-newSeed"></div>
            </div>
    </div>
</div>
<div class="card" id="card-newSeed">
    <h3> First time setup: let's create pass phrase</h3>
    <p> 
    A pass phrase is a long password that you only need to enter when you first install zero pass.
    </p>
    <p>
    An Ethereum crypto wallet extension is the easiest way to create a pass phrase. Do you have one ?
    </p>
    <div class="toolbar">
    <div class="button seedWithWallet">Yes</div>
    <div class="button cardlink" rel="card-passphrase">No</div>
    </div>
</div>
<div class="card" id="card-passphrase">
    <p> 
    A pass phrase is like a very long password used to generate passkey and 
    encrypt your data. <strong>Be sure to remember it, it will never be 
        displayed again !</strong>
    </p>
    <textarea  rows="8" class="seedTextArea"></textarea>
    <div id="seedStrength">
    </div>
    <div class="button cardlink" id="saveSeed" rel="card-educate"> Save my pass phrase </div>
</div>
<div class="card" id="card-educate">
    <p> 
    Your passkey has been saved:
    <ul>
        <li>Make sure to remember it, it is not recoverable</li>
        <li>Make sure to not share: anyone with your pass phrase can steal your access</li>
    </ul>
    </p>
    <div class="button passphrase-confirm">Got it</div>
</div>
`
var walletPopupId
export function setSeedUX(el, onSuccess, prepend){
    var x = document.createElement("div")
    x.innerHTML = setSeedHtml
    if(prepend){ el.prepend(...x.children) } else { el.append(...x.children)}
    let seedTextArea = el.querySelector(".seedTextArea")
    let pin = el.querySelector(".pinInput")

    el.querySelector(".passphrase-confirm").addEventListener("click", async (e) => {
        success(e.target)
        if(typeof onSuccess != undefined && onSuccess != null){
            await onSuccess(seedTextArea.value, pin.value)
        }
    })

    seedTextArea.oninput = function(e) {
        let strength = getSeedStrengthLevel(e.currentTarget.value)
        document.querySelector("#seedStrength").innerHTML = seedStrengthMessages[strength]
    }

    el.querySelector(".seedWithWallet").addEventListener("click", async (e)=> {
        let tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        let tab = tabs[0];
        let seedUrl = 'https://0pass.me/cryptoseed.html?extId='+chrome.runtime.id
        if(tab.url.startsWith("chrome-extension://"+chrome.runtime.id)){
            chrome.tabs.update({url: seedUrl+"&w=popup"});
        } else {
            let height = 350
            let width = 365
            let window = await chrome.windows.getCurrent()
            let left =Math.floor((window.width/2)-(width/2)) + window.left
            let top =Math.floor((window.height/3)-(width/2)) + window.top

            // let exist = await chrome.tabs.query({ windowId: walletPopupId})
            // if(exist.length>0){
            //     chrome.windows.remove(walletPopupId)
            // }
            let popup = await chrome.windows.create(
                {
                    focused: true,
                    height: height,
                    width:width,
                    type: "popup",
                    url: seedUrl,
                    left:left,
                    top:top
                }
            )
            walletPopupId = popup.id
            let handler
            handler = async (id)=>{
                //if(id != popup.id){ return } TODO: somehow the id is always different on close and open
                if(typeof onSuccess != undefined && onSuccess != null){
                    let seed = await chrome.runtime.sendMessage({ id:"getTempSeed"})
                    await onSuccess(seed, pin.value)
                }
                chrome.windows.onRemoved.removeListener(handler)
            }
            chrome.windows.onRemoved.addListener(handler)
            
        }
    })

    seedTextArea.closest(".card").addEventListener("activated", () => {   
        seedTextArea.focus()
        window.setTimeout(function(){seedTextArea.dispatchEvent(new InputEvent("input"))}, 800)
    })

    window.setTimeout(() => pin.focus({preventScroll:true}), 300)
    return document.getElementById("card-newPin")
}