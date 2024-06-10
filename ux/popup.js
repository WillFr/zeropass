

import { hookConsole } from "../lib/hookit.js"
import * as Storage from "../lib/storage.js"
import * as proxy from "../lib/proxy.js"
import * as binary from "../lib/binary.js" 
import { activateCard, genericEventHandling, initTheme, success} from "./common.js"
import { toPassword, data2Encrypted, encrypted2Data } from "../lib/crypto.js"
import {setSeedUX} from "./setSeed.js"
import {setPinUX} from "./setPin.js"
let elements = {}

const ss= new Proxy(new Storage.SecureStorage(), {
    get: function(target, fn) {
        return async (...args) => {
            let ofn=fn
            if(fn == "getSeed"){ fn="getSeedArray" }
            let res = await chrome.runtime.sendMessage({ id:"storageAdapter", method: fn, args: args})
            if(res != null && typeof res === 'object' && "__error__" in res){
                throw new Error("Proxied for "+fn+": "+res.__error__)
            }
            if(ofn=="getSeed"){
                res = res == null ? null : Uint8Array.from(res).buffer
            }
            return res
        }
    }
});

document.addEventListener("DOMContentLoaded",async function(){
    hookConsole(ss)
    initTheme(ss)
    init()
    
    genericEventHandling()
    updateKeyTable(ss)
    handleCloudEvents(ss)
    handleSeedEvents(ss)
    handleBackupEvents(ss)
    handleSettingsEvents(ss)
    handleCreateEvents(ss)
    handleConfirmEvents(ss)

    elements.toolbar.lockBtn.addEventListener("click", async () => {
        await chrome.runtime.sendMessage({ id:"resetStorage"})
        window.close()
    })

    if(!(await ss.isSeeded()) || !(await ss.isUnlocked())) {
        elements.tabs.settings.div.classList.toggle('collapsed')
        elements.tabs.settings.div.classList.toggle('expanded')
        elements.toolbar.settingBtn.classList.add("selected")
        elements.toolbar.div.style.visibility="hidden"

        if(!await ss.isSeeded()){
            elements.tabs.settings.newPinCard.dispatchEvent(new Event("activate", {bubbles:true}))
        } else {
            elements.tabs.settings.setPinCard.dispatchEvent(new Event("activate", {bubbles:true}))
        }
    }
    // cloudOp(() => new Promise( async (res, rej) =>{
    //     if(await ss.getApiKey() == null){ rej()}
    //     else { 
    //         await cloudOp(ss.cloudSync) ? res() : rej()
    //     }
    // }))
});

function init(){
    elements = {
        top:document.getElementById("top"),
        toolbar:{
            div: document.getElementById("toolbar"),
            cloudBtn: document.getElementById("cloudsync-btn"),
            backupBtn: document.getElementById("backup-btn"),
            helpBtn: document.getElementById("help-btn"),  
            settingBtn: document.getElementById("settings-btn"),
            lockBtn: document.getElementById("lock-btn")
        },
        tabs:{
            cloud:{
                div: document.getElementById("cloud-tab"),
                info: document.getElementById("cloud-info"),
                apiKeyInput: document.getElementById("apiKeyInput"),
                newApiKeyInput: document.getElementById("apiKey"),
                saveApiKeyBtn: document.getElementById("saveApiKeyBtn"),
                emailInput: document.getElementById("apiEmail"),
                recoverApiKeyByEmailBtn: document.getElementById("recoverApiKeyByEmailBtn"),
                buyApiKeyBtn: document.getElementById("buyApiKeyBtn"),
                deleteCloudDataBtn: document.getElementById("deleteCloudData"),
                cloudSyncBtn: document.getElementById("cloudSyncBtn"),
                mainCard: document.getElementById("card-cloud-main"),
                emailNotFoundCard: document.getElementById("email-notFound")
            },
            settings:{
                div: document.getElementById("settings-tab"),
                themePicker: document.getElementById("themePicker"),
                allowScriptsCheckbox: document.getElementById("allowScriptsCheckbox"),
                exportBtn: document.getElementById("export"),
                importBtn: document.getElementById("import"),
                importInput: document.getElementById("importInput"),
                cardwrapper: document.getElementById("settings-cards"),
                qrCodeCard: document.getElementById("card-qrcode"),
                newSeedCard: null,
                newPinCard: null,
                textareaCard: document.getElementById("card-passphrase"),
                mainCard: document.getElementById("card-setting-main"),
                logsCard: document.getElementById("card-logs"),
                logsList:  document.getElementById("logsList"),
                backupPreResetBtn: document.getElementById("backupPreResetBtn"),
            },
            create:{
                div: document.getElementById("create-tab"),
                domain: document.getElementById("createPasswordFor"),
                username: document.getElementById("createPasswordUsername"),
                salt: document.getElementById("createPasswordSalt"),
                createBtn: document.getElementById("createPassword"),
                copyBtn: document.getElementById("copyPassword")
            },
            confirm:{
                div: document.getElementById("confirm-tab"),
                ask: document.getElementById("confirm-ask"),
                acceptBtn: document.getElementById("confirm-accept"),
                rejectBtn: document.getElementById("confirm-reject"),
                onAccept: function(){},
                onReject: function(){}
            }
        }
    }
}

/**
 * 
 * @param {SecureStorage} ss 
 */
async function updateKeyTable(ss){
    let allKeys = await ss.getAllKeys()
    let keys = allKeys.reduce(function(a, b){ return a.concat(b) }, [])
    let tbody = document.querySelector("#passkey-table>tbody")
    tbody.innerHTML = ''
    
    let tools = document.querySelector("#passkey-table>thead>tr>th.tools>ul")
    tools.parentElement.style.display = "none"
    for(let key of keys){
        let newRow = tbody.insertRow();
        newRow.classList.add("passkey")
        let rpCell = newRow.insertCell()
        rpCell.appendChild(document.createTextNode(key.rp.name))
        let usernameCell = newRow.insertCell()
        usernameCell.classList.add("copyable")
        usernameCell.appendChild(document.createTextNode(key.user.displayName))
        let rowtools = tools.cloneNode(true)
        newRow.insertCell().appendChild(rowtools)
        let detailRow = tbody.insertRow();
        detailRow.classList.add('detail');
        let detailCell = detailRow.insertCell();
        detailCell.setAttribute("colspan",3)
        let input = document.createElement("textarea");
        detailCell.appendChild(input)
        input.value = JSON.stringify(key, null, "  ")
        input.cols = "37";

        rpCell.addEventListener('click', ()=>{
            if (detailRow.style.display != "table-row"){
                detailRow.style.display = 'table-row';
            } else {
                detailRow.style.display = 'none'
            }
        });

        rowtools.addEventListener("click", async (e) => {
            if(e.target.classList.contains("toolicon") && e.target.classList.contains("delete")){
                elements.tabs.confirm.ask.innerText = "Are you sure you want to remove the passkey for "+key.user.displayName+" on "+key.rp.name + " ?"}
                elements.tabs.confirm.onAccept = async function(){
                    await ss.deleteKey(key.rp.id, key.user.name)
                    await updateKeyTable(ss)
                }
                showTab(elements.tabs.confirm.div)
        })
    }

    let allPw = await ss.getAllPasswords()
    for(let pw of allPw){
        let newRow = tbody.insertRow();
        newRow.classList.add("password")
        newRow.insertCell().appendChild(document.createTextNode(pw.domain))
        let usernameCell = newRow.insertCell()
        usernameCell.classList.add("copyable")
        usernameCell.appendChild(document.createTextNode(pw.username))
        let rowtools = tools.cloneNode(true)
        newRow.insertCell().appendChild(rowtools)

        rowtools.addEventListener("click", async (e) => {
            let icon = e.target.closest(".toolicon")
            if(icon.classList.contains("delete")){
                await ss.deletePassword(pw)
                await updateKeyTable(ss)
            } else if (icon.classList.contains("copy")){
                let password = await toPassword(
                    pw.domain,
                    pw.username,
                    pw.salt,
                    await ss.getSeed())
                navigator.clipboard.writeText(password);
            }
        })
    }

    // now order the table
    let tabs = await chrome.tabs.query({active: true, lastFocusedWindow: true});
    if(tabs[0] === undefined){
        console.error("No current tab", tabs)
        return 
    }
    let url = new URL(tabs[0].url)

    for(let domainTd of tbody.querySelectorAll("td:first-child")){
        if((domainTd.innerText+" ").startsWith(url.hostname +" ")){
            let tr = domainTd.closest("tr")
            let parent = tr.parentElement
            parent.removeChild(tr)
            parent.prepend(tr)
        }
    }
}

/**
 * 
 * @param {Storage.SecureStorage} ss 
 */
async function handleCloudEvents(ss){
    let cloudTab = elements.tabs.cloud

    let mainCardOpenHandler = async ()=> {
        let apiKey = await ss.getApiKey()
        console.log("API key", apiKey)
        let isConnected = apiKey == null ? false : await ss.cloudIsConnected()
        if(apiKey!=null && !isConnected){
            await cloudOp(ss.cloudPing)
            isConnected = await ss.cloudIsConnected()
        }
        cloudTab.info.innerText = apiKey!=null && !isConnected ? ` It appears your API key might be invalid
        ` : ""
        cloudTab.apiKeyInput.value=apiKey==null?"":apiKey
        cloudTab.buyApiKeyBtn.classList.remove("disabled", "hide")
        cloudTab.buyApiKeyBtn.classList.add(apiKey==null || !isConnected?"noop":"hide")
        cloudTab.deleteCloudDataBtn.classList.remove("disabled", "hide")
        cloudTab.deleteCloudDataBtn.classList.add(apiKey!=null && !isConnected ? "disabled": apiKey==null ? "hide" : "noop")
        cloudTab.cloudSyncBtn.classList.remove("disabled", "hide")
        cloudTab.cloudSyncBtn.classList.add(apiKey!=null && !isConnected ? "disabled": apiKey==null ? "hide" : "noop")
    }
    cloudTab.div.addEventListener("tabOpened", async () => {
        cloudTab.mainCard.dispatchEvent(new Event("activate", {bubbles:true}))
        await mainCardOpenHandler()
    })
    cloudTab.mainCard.addEventListener("activated", mainCardOpenHandler)
    
    cloudTab.saveApiKeyBtn.addEventListener("click", async () => {
        let newApiKeyVal = cloudTab.newApiKeyInput.value

        if(await cloudOp(ss.saveApiKey, newApiKeyVal)){
            cloudTab.apiKeyInput.value=newApiKeyVal
            cloudTab.mainCard.dispatchEvent(new Event("activate", {bubbles: true}))
        } else {
            await ss.saveApiKey(null)
            cloudTab.apiKeyInput.value=""
            cloudTab.apiKeyInput.setAttribute("placeholder", "Your api key does not seem valid")
        }
    })

    cloudTab.buyApiKeyBtn.addEventListener('click', async function(e){
        chrome.tabs.create({ url: "https://0pass.me/?extId="+chrome.runtime.id + "#pricing"});
    })

    cloudTab.deleteCloudDataBtn.addEventListener("confirmedClick", async function(e){
        let res = window.confirm("All your data will be gone ! The only way to recover is to import a backup ")
        if(res){
            await ss.cloudClear()
            // TODO: make generic
            e.target.classList.add("done")
            let old = e.target.innerHTML
            e.target.innerHTML = "&#10004;&#65039; Done ! "
            window.setTimeout(function(){
                e.target.innerHTML = old
                e.target.classList.remove("done")
            }, 1000)
        }
    })

    cloudTab.cloudSyncBtn.addEventListener("click", async function(e){
        await ss.cloudSync()
        success(cloudTab.cloudSyncBtn)
    })

    cloudTab.recoverApiKeyByEmailBtn.addEventListener("click", async () => {
        if(await ss.sourceApiKey(cloudTab.emailInput.value)){
            cloudTab.mainCard.dispatchEvent(new Event("activate", {bubbles: true}))
        } else {
            cloudTab.emailNotFoundCard.dispatchEvent(new Event("activate", {bubbles: true}))
        }
    })
}

/**
 * 
 * @param {Storage.SecureStorage} ss 
 */
async function handleSeedEvents(ss){
    let seedTab = elements.tabs.settings

    seedTab.qrCodeCard.addEventListener("activated", async (e) => {
        let qrCode = new QRCode("qrcode")
        let seedB64 = binary.toB64URL(binary.ab2str(await ss.getSeed()))
        qrCode.makeCode(seedB64);
    })
}

/**
 * 
 * @param {Storage.SecureStorage} ss 
 */
async function handleBackupEvents(ss){
    let backupHandler = async (e)=>{
        let content = JSON.stringify(await ss.exportStorage("logs"))
        
        let contentEncrypted = await data2Encrypted(content, await ss.getSeed())
        let blob = new Blob(
            [ contentEncrypted ],
            {type : "text/plain;charset=UTF-8"}
        );
        let url = window.URL.createObjectURL(blob);

        chrome.downloads.download({
            url: url,
            filename: "passkey.pk"
        })
        success(e.target)
    }
    elements.tabs.settings.exportBtn.addEventListener('click', backupHandler)
    elements.tabs.settings.backupPreResetBtn.addEventListener('click', backupHandler)

    elements.tabs.settings.importBtn.addEventListener('click', async ()=>{
        elements.tabs.settings.importInput.click()
    })
    
    elements.tabs.settings.importInput.addEventListener('change', async function(e){
        let files = e.target.files
        if(files.length==1){
            let reader = new FileReader();
            reader.onload = async function(ee){
               try{
                    let content = await encrypted2Data(ee.target.result, await ss.getSeed())
                    await ss.importStorage(JSON.parse(content))
                    await updateKeyTable(ss)
                    success(elements.tabs.settings.importBtn)
                } catch (error){
                    console.log("Import failed: ", error)
                    alert("Could not import key, have you set your master key properly ?")
                }
            }
            reader.readAsText(e.target.files[0]);
        }
    })
}

/**
 * 
 * @param {Storage.SecureStorage} ss 
 */
async function handleSettingsEvents(ss){

    elements.tabs.settings.div.addEventListener("tabOpened", async ()=> {
        let currentTheme = await ss.getSetting("theme", "popup_ocean.css")
        elements.tabs.settings.themePicker.value = currentTheme
        elements.tabs.settings.allowScriptsCheckbox.checked =  await ss.getSetting("useScripts", false)
        elements.tabs.settings.mainCard.dispatchEvent(new Event("activate", {bubbles:true}))
    })
    elements.tabs.settings.themePicker.addEventListener("change", async (e) => {
        document.getElementById("theme").setAttribute("href", "style/"+e.target.value)
        await ss.saveSetting("theme", e.target.value)
    })

    elements.tabs.settings.logsCard.addEventListener("activated", async e => {
        elements.tabs.settings.logsList.innerHTML = ""
        let allLogs = await ss.getLogs()
        allLogs.forEach(x => {
            let liElement = document.createElement("li")
            liElement.innerHTML = x
            elements.tabs.settings.logsList.appendChild(liElement)
        })
    })
    setSeedUX(elements.tabs.settings.cardwrapper, async function(seed, pin){
        if(seed != null) { await ss.saveSeed(seed, 0, pin)}
        if(await ss.getSeed() != null){
            elements.toolbar.div.style.visibility="visible"
            updateKeyTable(ss)
            elements.toolbar.settingBtn.dispatchEvent(new Event("click"))
        }
    })
    setPinUX(elements.tabs.settings.cardwrapper, async function(pin){
        await ss.unlock(pin)
        elements.toolbar.div.style.visibility="visible"
        updateKeyTable(ss)
        elements.toolbar.settingBtn.dispatchEvent(new Event("click"))
    }, true)
    elements.tabs.settings.newSeedCard = document.getElementById("card-newSeed")
    elements.tabs.settings.newPinCard = document.getElementById("card-newPin")
    elements.tabs.settings.setPinCard = document.getElementById("card-setPin")
    elements.tabs.settings.textareaCard = document.getElementById("card-passphrase")

    let disabledDomains = await proxy.getDisabledDomain(ss)
    let tbody = document.querySelector("#disabled-domains-table>tbody")
    tbody.innerHTML = ''
    for(let i=0;i<disabledDomains.length;i++){
        let newRow = tbody.insertRow();
        newRow.insertCell().appendChild(document.createTextNode(disabledDomains[i]))
        let btn = document.createElement("span")
        let domain = disabledDomains[i]
        btn.addEventListener("click", async ()=> {
            newRow.remove()
            await proxy.enableDomain(ss, domain)
        })
        btn.classList.add("toolicon")
        btn.classList.add("delete")
        btn.setAttribute("title", "enable this domain")
        btn.innerHTML="&#x274C;"
        newRow.insertCell().appendChild(btn)
    }

    elements.tabs.settings.allowScriptsCheckbox.addEventListener("change", async (e)=>{
        const checked = elements.tabs.settings.allowScriptsCheckbox.checked
        const permissions = ["webNavigation", "scripting", "activeTab"]
        if(checked){
            chrome.permissions.request({
                permissions: permissions,
            }, async (granted) => {
                if(granted){
                    await ss.saveSetting("useScripts", checked)
                } else {
                    e.preventDefault()
                }
            })
        } else {
            chrome.permissions.remove({
                permissions: permissions
              }, async (removed) => {
                if (removed) {
                    await ss.saveSetting("useScripts", checked)
                } else {
                    e.preventDefault()
                }
            });
        }
    })
}

/**
 * 
 * @param {Storage.SecureStorage} ss 
 */
async function handleCreateEvents(ss){
    let tabs = await chrome.tabs.query({active: true, lastFocusedWindow: true});
    let url = tabs[0] === undefined ? { value: ""} : new URL(tabs[0].url) 

    let createTab = elements.tabs.create
    createTab.domain.value=url.hostname

    createTab.createBtn.addEventListener("click", async ()=>{
        let password = await toPassword(
            createTab.domain.value,
            createTab.username.value,
            createTab.salt.value, 
            await ss.getSeed())
        navigator.clipboard.writeText(password);
        await ss.storePassword(createTab.domain.value, createTab.username.value, createTab.salt.value)
        await updateKeyTable(ss)
    })

    createTab.copyBtn.addEventListener("click", async ()=>{
        let password = await toPassword(
            createTab.domain.value,
            createTab.username.value,
            createTab.salt.value,
            await ss.getSeed())
        navigator.clipboard.writeText(password);
    })
}

/**
 * 
 * @param {Storage.SecureStorage} ss 
 */
async function handleConfirmEvents(ss){
    elements.tabs.confirm.acceptBtn.addEventListener("click", ()=>{
        elements.tabs.confirm.onAccept()
        hideTab(elements.tabs.confirm.div)
    })
    elements.tabs.confirm.rejectBtn.addEventListener("click", ()=>{
        elements.tabs.confirm.onReject()
        hideTab(elements.tabs.confirm.div)
    })
}

function hideTab(tab){
    tab.classList.add('collapsed')
    tab.classList.remove('expanded')
}

function showTab(tab){
    tab.classList.remove('collapsed')
    tab.classList.add('expanded')
}

function togggleTab(tab){
    tab.classList.togggle('collapsed')
    tab.classList.togggle('expanded')
}

async function cloudOp(fn, ...args){
    try{
        await fn(...args)
        elements.toolbar.cloudBtn.classList.remove("disconnected")
        elements.toolbar.cloudBtn.setAttribute("title", "Cloud sync is on")
        return true
    } catch (err){
        console.error(err)
        elements.toolbar.cloudBtn.classList.add("disconnected")
        elements.toolbar.cloudBtn.setAttribute("title", "Cloud sync is off: make sure you have a seed and an api key")
        return false
    }
}

