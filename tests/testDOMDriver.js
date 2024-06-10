import { runTests } from "./testable.js"
import * as cryptotest from "./crypto_test.js"

document.addEventListener("DOMContentLoaded",async function(){
    let testFiles = [(new URLSearchParams(window.location.search)).get('script')]
    let match = [(new URLSearchParams(window.location.search)).get('match')]
    await runTests(match)

})