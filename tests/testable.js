"use strict";
import { Mutex } from "../lib/mutex.js"

const mutex = new Mutex();
const tests = {}

/**
 * test function
 * @param {string} desc
 * @param {function} fn
 */
export function it(desc, fn){
    tests[desc] = fn
}

export async function runTests(match){
    for(let [desc, fn] of Object.entries(tests)){
        if(match != null && !desc.includes(match)){ continue }
        let release = await mutex.lock()
        const li = document.createElement("li")
        document.getElementById("test-list").appendChild(li)
        try {
            await fn();
            li.innerHTML = '&#x2714 ' + desc
            console.log('\x1b[32m%s\x1b[0m', '\u2714 ' + desc)
        } catch (error) {
            console.log('\n')
            console.log('\x1b[31m%s\x1b[0m', '\u2718 ' + desc)
            console.error(error)
            console.log(error)
            li.innerHTML = '&#x2718 ' + desc
            li.classList.add("error")
        } finally {
            release()
        }
    }
}

export function assert(isTrue) {
    if (!isTrue) {
        throw new Error();
    }
}

