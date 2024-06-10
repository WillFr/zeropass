"use strict";

import * as Storage from '../lib/storage.js'



test('should unlock storage and store a setting', async function() {
  await chrome.storage.local.clear()
  let bs = new Storage.ChromeLocalStorage()
  let ss = new Storage.SecureStorage(bs)

  await ss.unlock("123")

  await ss.saveSetting("testSetting", "abc")
  let val = await ss.getSetting("testSetting")

  expect(val == "abc");

  let cVal = await chrome.storage.local.get(["testSetting"])
  expect(!("testSetting" in cVal))
});

test('should save the seed hash', async function(){
  await chrome.storage.local.clear()
  let bs = new Storage.ChromeLocalStorage()
  let ss = new Storage.SecureStorage(bs)

  await ss.unlock("123")

  await ss.saveSeed("this is a seed", 0, "123")
  let seedBuf = await ss.getSeed()
  expect(seedBuf instanceof ArrayBuffer)
})

test('syntactic sugar methods are working', async function(){
  await chrome.storage.local.clear()
  let bs = new Storage.ChromeLocalStorage()
  let ss = new Storage.SecureStorage(bs)

  await ss.unlock("123")

  await ss.saveApiKey("this is the api key")
  let apiKey = await ss.getApiKey()
  expect(apiKey == "this is the api key")
  await ss.saveApiKey(null)
})

test('passkey lifecycle', async function(){
  await chrome.storage.local.clear()
  let bs = new Storage.ChromeLocalStorage()
  let ss = new Storage.SecureStorage(bs)

  await ss.unlock("123")

  let rp={
    id: "the rp id",
  }
  let user={
    id: "the user id",
    name: "the user name",
    displayname: "the display name"
  }
    
  await ss.storeKey(rp, user, "direct")
  let keyObj = await ss.getKey(rp.id, user.name)

  expect(JSON.stringify(keyObj.user) == JSON.stringify(user))
  expect(keyObj.attestationFmt == "direct")

  await ss.deleteKey(rp.id, user.name)
  let [guser2, attestationFmt2] = await ss.getKey(rp.id, user.name)
  expect(guser2 == null && attestationFmt2 == null)

})

test("should export then import all encrypted storage", async function(){
 await chrome.storage.local.clear()
  let bs = new Storage.ChromeLocalStorage()
  let ss = new Storage.SecureStorage(bs)

  await ss.unlock("123")

  await ss.set("a", 1)
  await ss.set("b", 2)
  await ss.saveSetting("testSetting", "testValue")
  await ss.saveApiKey("abc")

  let exported = await ss.exportStorage()
  await bs.clear()

  expect(await ss.get("a") == null)

  await ss.importStorage(exported)
  expect(await ss.get("a") == 1)
  expect(await ss.get("b") == 2)
  expect(await ss.getSetting("testSetting") == "testValue")
  expect(await ss.getApiKey() == "abc")
})

test("should get, set, getAll cloud API", async function(){
  await chrome.storage.local.clear()
  let cs = new Storage.CloudStorage("988aabac-6212-4630-9d61-c40f51420c70")
  await cs.clear()
  await cs.set("a", "abc")
  await cs.set("b", "cde")
  await cs.set("d", "fgh")
  expect(await cs.get("a") == "abc")
  expect(await cs.get("b") == "cde")
  expect(await cs.get("d") == "fgh")
  expect(await cs.get("v") == null)
  expect(JSON.stringify(await cs.getAll(["a", "b"]))  == JSON.stringify(["abc", "cde"]))
  await cs.deleteAll(["b", "d", "v"])
  expect(await cs.get("a") == "abc")
  expect(await cs.get("b") == null)
  expect(await cs.get("d") == null)
  expect(await cs.get("v") == null)
  await cs.set("z", "123")
  let all = await cs.getAllStorage()
  expect(JSON.stringify(all) == JSON.stringify({a: 'abc', z: '123'}))
  await cs.clear()
  all = await cs.getAllStorage()
  expect(JSON.stringify(all) == JSON.stringify({}))
  await cs.setAllStorage({a: 'abc', z: '123'})
  all = await cs.getAllStorage()
  expect(JSON.stringify(all) == JSON.stringify({a: 'abc', z: '123'}))
})
