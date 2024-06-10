export let keyAlgo = {
    name: "ECDSA",
    namedCurve: "P-256",
}

export let signAlgo = {
    name: "ECDSA",
    hash: { name: "SHA-256" },
}

export function uint8Arr2str(arr){
    return Array.from(arr, b => b.toString(16)).join(" ").padEnd(2,"0")
}

export function getSeedStrengthLevel(seed){
    if(seed == undefined || seed == null){ return 0 }
    return Math.min(Math.floor(seed.length/10),7)
}
