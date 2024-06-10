import puppeteer from "puppeteer";
import crypto from 'crypto'

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as h from './helper.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXTENSION_PATH = dirname(dirname(__dirname));
const EXTENSION_ID = 'okammondjihbnmdhejehpdbedbgdfclg';

const CBWALLET_EXTENSION_PATH = "C:\\Users\\Guillaume\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Extensions\\hnfanknocfeofbddgcijnmhnfnkdnaad\\3.62.2_13"
const CBWALLET_EXTENSION_ID = "hnfanknocfeofbddgcijnmhnfnkdnaad"
let browser;
browser = await puppeteer.launch({
  headless: false,
  args: [
    `--disable-extensions-except=${EXTENSION_PATH},${CBWALLET_EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`
  ]
});

const username = crypto.randomBytes(10).toString('hex')

test('E2E: Init pin, set pass phrase', async () => {
  const d = 1000
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${EXTENSION_ID}/popup.html`);
  await h.firstTimeInit(page, d)
}, 10000)

test('E2E: register passkey, and authenticate', async () => {
  const d = 1000
  const webauthnPage = await browser.newPage();
  await webauthnPage.goto("https://webauthn.io/", {waitUntil: 'load'})
  await webauthnPage.type("#input-email", username, {delay:50})
  let newPagePromise = h.getNewPageWhenLoaded(browser)
  await webauthnPage.click("#register-button")
  let popup = (await newPagePromise).mainFrame();
  await h.delay(d)
  await popup.click("#acceptBtn")
  await h.delay(2000)
  expect(await webauthnPage.$eval(".alert.alert-success", x => x.innerHTML))
      .toBe("Success! Now try to authenticate...")
  await h.delay(d)
  newPagePromise = h.getNewPageWhenLoaded(browser)
  await webauthnPage.click("#login-button")
  popup = (await newPagePromise).mainFrame();
  await h.delay(d)
  await popup.click("#usernames>li:nth-child(2)>div")
  await h.delay(d)
  await webauthnPage.$(".hero.confetti")
  await h.delay(d);
}, 30000);

test('E2E: Delete key then recover it', async () => {
  const d = 1000
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${EXTENSION_ID}/popup.html`);
  await h.delay(d);
  await page.click("#passkey-table > tbody > tr.passkey > td:nth-child(3) > ul > li:nth-child(1) > span")
  await h.delay(d)
  await page.click("#confirm-tab.expanded #confirm-accept.button")
  await h.delay(100);
  expect(await page.$$eval("#passkey-table > tbody > tr", x => x.length))
      .toBe(0)
  const webauthnPage = await browser.newPage();
  await webauthnPage.goto("https://webauthn.io/logout", {waitUntil: 'load'})
  await h.delay(d)
  let newPagePromise = h.getNewPageWhenLoaded()
  await webauthnPage.click("#login-button")
  let popup = (await newPagePromise)
  await h.delay(d)
  await popup.click("#usernames>li:nth-child(1)>div")
  await h.delay(d)
  await popup.keyboard.type(username, {delay:50})
  popup.keyboard.press('Enter')
  await popup.select("#recoverAttest", "none")
  await popup.click("#recoverUsernameOk")
  await h.delay(d)
  await webauthnPage.$(".hero.confetti")
  await h.delay(10000);
}, 60000);

test('E2E: test buy an API key', async () => {
  const d = 1000
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${EXTENSION_ID}/popup.html`);
  await page.click("#toolbar #cloudsync-btn")
  await h.delay(d)
  let newPagePromise = h.getNewPageWhenLoaded(browser)
  await page.click("#cloud-tab.expanded #card-cloud-main.active #buyApiKeyBtn")
  let web = await newPagePromise

  await h.delay(d)
  web.click('form input[type="submit"]')
  
  await web.waitForSelector('#email', {timeout: 30000});
  await web.type("#email", 'testemail@gmail.com', {delay:50})
  await web.type("#cardNumber", '4242424242424242', {delay:50})
  await web.type("#cardExpiry", '0428', {delay:50})
  await web.type("#cardCvc", '123', {delay:50})
  await web.type("#billingName", 'test user', {delay:50})
  await web.click("#billingAddressLine1")
  await web.type("#billingAddressLine1", '2201 3rd ave', {delay:50})
  await h.delay(1000)
  await web.keyboard.press('Enter')
  await h.delay(200)
  await web.evaluate(() => {
    document.querySelector("#enableStripePass").click();
  });
  await h.delay(2000)
  await web.click("button.SubmitButton")
  await browser.once('targetcreated')
  await web.waitForNavigation({waitUntil: 'domcontentloaded'});
  let apiKey = await web.$eval("#api-key", x => x.innerText.trim())
  h.delay(d)
  await page.bringToFront();
  await page.reload()
  h.delay(d)
  await page.click("#cloudsync-btn")
  h.delay(d)
  expect(await page.$eval("#cloud-tab.expanded #card-cloud-main.active #apiKeyInput", x => x.value.trim()))
       .toBe(apiKey)
  expect(await page.$$eval("ul.actions .button:not(.hide)", x => x.length))
       .toBe(3)
}, 30000)


// browser.close()
// browser = await puppeteer.launch({
//   headless: false,
//   args: [
//     `--disable-extensions-except=${EXTENSION_PATH}`,
//     `--load-extension=${EXTENSION_PATH}`
//   ]
// });

test('test register password without seed and without username: should prompt for seed and username', async () => {

})


