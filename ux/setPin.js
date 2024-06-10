const setPinHtml = `
<div class="card" id="card-setPin">
    <h3> Enter your pin</h3>
    <p>
    Your pin is necessary to decrypt the local storage. It is asked every time you restart your browser.
    </p>
    <div class="button card-wrapper horizontal">
            <div class="textsubbutton">
                <input type="password" class="pinInput" placeholder="Enter your pin" />
                <div class="cardlink submit setPinBtn"></div>
            </div>
    </div>
</div>`

export function setPinUX(el, onSuccess, prepend){
    var x = document.createElement("div")
    x.innerHTML = setPinHtml
    if(prepend){ el.prepend(...x.children) } else { el.append(...x.children)}
    let pin = el.querySelector(".pinInput")

    el.querySelector(".setPinBtn").addEventListener("click", async e => {
        await onSuccess(pin.value)
    })
    window.setTimeout(() => pin.focus({preventScroll:true}), 300)
    return document.getElementById("card-setPin")
}