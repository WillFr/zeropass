"use strict";


export function toLittleEndian(bigNumber) {
    let result = new Uint8Array(32);
    for(let i=0; i<result.length;i++){
        result[i] = Number(bigNumber % 256n);
        bigNumber = bigNumber / 256n;
    }
    return result;
}

export function toBigEndian(bytes) {
    return toLittleEndian(bytes).reverse();
}

export function fromBigEndian(bytes){
    let result = 0n
    let buf = new Uint8Array(bytes)

    for(let i=0; i<buf.length;i++){
        result = result * 256n + BigInt(buf[i])
    }

    return result
}

export function toB64URL(input){
    return btoa(input).replace(/\+/g,'-').replace(/\//g,'_').replace(/\=+$/m,'')
}

export function fromB64URL(input){
    return atob(input.replace(/-/g, '+').replace(/_/g, '/'))
}

export function str2ab(str) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

export function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
}

export function concatAB(){
    let bufs = []
    let tl = 0
    for (let i = 0; i < arguments.length; ++i) {
        let buf = new Uint8Array(arguments[i])
        bufs.push(buf)
        tl += buf.length
    }

    let ret = new Uint8Array(tl)
    let i = 0
    for(let k = 0; k < bufs.length; ++k){
        let buf = bufs[k]
        for(let j=0; j<buf.length;j++){
            ret[i++] = buf[j]
        }
    }
    
    return ret.buffer
}

/**
 * Copies smallbuff inside bigbuff at index at
 * @param {Array<any>} bigbuff
 * @param {Array<any>} smallbuff 
 * @param {int} at the start index
 * @returns the next index in bigbuff
 */
export function copyAt(bigbuff, smallbuff, at){
    let i = at
    let len = smallbuff.length
    if(len===undefined){
        throw new Error("copyAt does not work on arraybuffer, please wrap in a uint8array")
    }
    for(let j=0; j<len;j++){
        bigbuff[i++] = smallbuff[j]
    }
    return i
}

export function uint8Arr2str(arr){
    return Array.from(arr, b => b.toString(16)).join(" ").padEnd(2,"0")
}

