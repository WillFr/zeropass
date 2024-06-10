import { webcrypto } from 'crypto';
import {chrome} from 'jest-chrome'

Object.defineProperties(global, {
  crypto: { value: webcrypto, writable: true },
  chrome: { value: chrome}
})

let storage = {}

chrome.storage.local.get.mockImplementation((keys) => {
  if(!Array.isArray(keys)){ keys = [keys] }
  let ret = Object.fromEntries(
    keys.map(x => [x, storage[x]])
  ) 
  return ret
})
chrome.storage.local.set.mockImplementation((keyValues) => {
  for(let [k,v] of Object.entries(keyValues)){
    storage[k] = v
  }
})
chrome.storage.local.remove.mockImplementation((keys) => {
  for(let k of keys){
    delete storage[k]
  }
})
chrome.storage.local.clear.mockImplementation(() => {
  storage = {}
})