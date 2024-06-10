export async function initTheme(ss){
    let theme = await ss.getSetting("theme", "popup_ocean.css")
    document.getElementById("theme").setAttribute("href", "/style/"+theme)
}

export function genericEventHandling(){
    cardHandling()

    document.querySelectorAll(".copyable").forEach(x => {
        x.addEventListener("click", (e) => {
            navigator.clipboard.writeText(e.target.closest(".copyable").innerText)
        })
    })

    document.querySelectorAll(".confirm").forEach(x => {
        x.addEventListener('click', async e => {
            let text = e.target.innerHTML
            if(text == e.target.attributes.confirm.value){
                window.clearTimeout(e.target.timeout)
                e.target.dispatchEvent(new MouseEvent("confirmedClick", e))
                e.target.innerHTML = e.target.attributes.orig.value
            } else {
                e.target.setAttribute("orig",text)
                e.target.innerHTML=e.target.attributes.confirm.value
                e.target.timeout = window.setTimeout(ee => {
                    e.target.innerHTML = e.target.attributes.orig.value
                }, 3000)
            }
        })
    })

    // todo: replace with CSS
    document.querySelectorAll(".tab-key").forEach(x => {
        x.addEventListener('click', async e => {
            let selected = x.parentElement.querySelector(".selected")
            if(selected!=null && selected != x){
                selected.dispatchEvent(new MouseEvent("click"))
            }
            let tabId = x.attributes.rel.value
            let tab = document.getElementById(tabId)

            x.classList.toggle('selected')
            if(tab.classList.contains("expanded")){
                tab.dispatchEvent(new Event("tabClosed"))
            } else {    
                tab.dispatchEvent(new Event("tabOpened"))
            }
            tab.classList.toggle('collapsed')
            tab.classList.toggle('expanded')
        })
    })

    document.addEventListener("keydown", (e) => {
        if (e.altKey){
            for(let btn of document.querySelectorAll(".tab.expanded .card.active :not(.card) .button, .card.active :not(.card) .button:not(div.tab *)")){
                if(btn.children.length == 0 && btn.innerText.toLowerCase()[0]==e.key){
                    btn.dispatchEvent(new MouseEvent("click", {bubbles: true}))
                }
            }
        }
    })

    document.querySelectorAll(".helpbtn").forEach(x => {
        let helpDiv = document.getElementById(x.getAttribute("rel"))
        x.addEventListener("mouseover", e => { 
            let bounds = x.getBoundingClientRect()
            helpDiv.style.top= bounds.top + "px"
            if(bounds.left < window.innerWidth/2) {
                helpDiv.style.left= bounds.left + "px"
                helpDiv.style.width = ((window.innerWidth - bounds.right)*0.8) + "px"
            } else {
                helpDiv.style.right= (window.innerWidth-bounds.right) + "px"
                helpDiv.style.width = (bounds.left*0.8) + "px"
            }
            helpDiv.classList.add("active")
        })
        x.addEventListener("mouseout", e => { helpDiv.classList.remove("active") })
    })
}

export function success(btn){
    let icon = document.createElement("div")
    icon.innerHTML = "&#x2713;"
    icon.classList.add("icon")
    btn.appendChild(icon)
    window.setTimeout(function(){btn.removeChild(icon)}, 1500)
    icon.classList.add("hide")
}

// todo: replace with CSS
function cardHandling(){
    let activateCard = function(x){
        let activeCard = x.parentElement.querySelector(":scope > .active")
        if(activeCard != null){ activeCard.classList.toggle("active") }
        x.classList.toggle("active")
        x.querySelector("input")?.focus({preventScroll:true})
        x.dispatchEvent(new Event("activated"))
    }
    let cardLinkClickHandler = function(x){
        let relCard = document.getElementById(x.attributes.rel.value)
        activateCard(relCard)
    }
    document.querySelectorAll(".cardlink").forEach(x => {
        x.addEventListener('click', async e => {
            cardLinkClickHandler(x)
        })
    })

    // TODO: replace with radio + CSS
    document.querySelectorAll(".card-wrapper").forEach(x => {
        x.addEventListener("activate", async e => { activateCard(e.target); e.preventDefault(); })
        x.addEventListener('click', async e => {
            if(e.target.classList.contains("cardlink")){
                cardLinkClickHandler(e.target)
            }
        })
        x.addEventListener("keydown", e =>{
            if(e.target.parentElement.classList.contains("textsubbutton")){
                if(e.key === 'Enter'){
                    e.target.parentElement.querySelector(".submit").dispatchEvent(new MouseEvent("click", {bubbles: true}))
                }
            }
        })

        let wrapCard = function(c){
            let children = c.childNodes
            let wrapper = document.createElement("div")
            if(children.length == 0){
                children = [document.createTextNode(c.innerText)]
            }
            wrapper.append(...children)
            wrapper.style.width=(x.clientWidth)  + "px"
            c.replaceChildren(wrapper)
        }
        x.querySelectorAll(":scope > .card").forEach(wrapCard)

        const observer = new MutationObserver((mutationList, observer) => {
            mutationList.map(m => Array.from(m.addedNodes.values())).flat().forEach(wrapCard)
        });

        // Start observing the target node for configured mutations
        observer.observe(x, { childList: true});

    })
}

export function activateCard(cardEl){
    cardEl.dispatchEvent(new Event("activate", {bubbles: true}))
}