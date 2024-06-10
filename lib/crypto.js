"use strict";

import * as bin from "./binary.js";

export let secp256r1 = {
    a: BigInt(-3),
    b: BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"),
    p: BigInt("115792089210356248762697446949407573530086143415290314195533631308867097853951"),
    n: BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"),
    Gx: BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
    Gy: BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"),
    h: BigInt(1),
}


var errCouldNotDecrypt = new Error("Could not decrypt")
// #region AES
export async function encrypted2Data(ivContentEncrypted, seed){
    let ivContentEncryptedBuf = new Uint8Array(bin.str2ab(bin.fromB64URL(ivContentEncrypted)))
    if(ivContentEncryptedBuf.length<12){
        throw new Error("Cannot decode data: the byte string is not long enough for the AES IV")
    }

    let aesKey = await getExportEncryptionKey(seed)

    let iv = new Uint8Array(12)
    let i=0
    for(let j=0; j<iv.length;j++){
        iv[j]=ivContentEncryptedBuf[i++]
    }
    let contentEncrypted = new Uint8Array(ivContentEncryptedBuf.length-12)
    for(let j=0; j<contentEncrypted.length;j++){
        contentEncrypted[j]=ivContentEncryptedBuf[i++]
    }

    try{
        let contentB = await crypto.subtle.decrypt({"name": 'AES-GCM', iv: iv}, aesKey, contentEncrypted)
        let content = new TextDecoder().decode(contentB)
        return content
    } catch(err) {
        console.error(err)
        console.trace(errCouldNotDecrypt)
        throw errCouldNotDecrypt
    }
}

export async function data2Encrypted(content, seed) {
    let aesKey = await getExportEncryptionKey(seed)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    let enc = new TextEncoder()
    let contentEncrypted = await crypto.subtle.encrypt(
        {"name": "AES-GCM", iv: iv},
        aesKey, 
        enc.encode(content)
    )
    let ivContentEncrypted = bin.concatAB(iv.buffer, contentEncrypted)
    return bin.toB64URL(bin.ab2str(ivContentEncrypted))
}

async function getExportEncryptionKey(seed){
    let seedBuf = bin.concatAB(bin.str2ab("KeyExport"), seed)
    let aesSeed=await seed2D(seedBuf)
    let aesJWK={
        "alg": "A256GCM",
        "ext": true,
        "k": bin.toB64URL(bin.ab2str(bin.toBigEndian(aesSeed))),
        "key_ops": ["encrypt", "decrypt"],
        "kty": "oct"
    }
    let aesKey = await crypto.subtle.importKey("jwk", aesJWK, {"name": "AES-GCM", length: 256}, true, ["encrypt", "decrypt"])
    return aesKey
}

// #endregion

// #region elliptic


// see: https://cryptobook.nakov.com/digital-signatures/ecdsa-sign-verify-messages
// see: https://asecuritysite.com/encryption/ecdh3
export async function GenerateECDSA(d, curve, keyAlgo){
    let [x,y] = scalar_mult(curve, d, curve.Gx, curve.Gy)

    let buffX = bin.toBigEndian(x).buffer
    let buffY = bin.toBigEndian(y).buffer

    let prKjwk = {
        crv: "P-256",
        d: bin.toB64URL(bin.ab2str(bin.toBigEndian(d).buffer)),
        ext: true,
        key_ops: ["sign"],
        kty: "EC",
        x: bin.toB64URL(bin.ab2str(buffX)),
        y: bin.toB64URL(bin.ab2str(buffY))
    }
    let puKjwk = {
        crv: "P-256",
        ext: true,
        key_ops: ["verify"],
        kty: "EC",
        x: bin.toB64URL(bin.ab2str(buffX)),
        y: bin.toB64URL(bin.ab2str(buffY))
    }

    let privateKey = await crypto.subtle.importKey("jwk", prKjwk, keyAlgo, true, ["sign",])
    let publicKey = await crypto.subtle.importKey("jwk", puKjwk, keyAlgo, true, ["verify",])

    return {
        privateKey: privateKey,
        publicKey: publicKey
    }

}

export function ECDSASigtoDER(input){
    let inputBuff = new Uint8Array(input)
    let rneg=0
    let sneg=0
    if (inputBuff[0] >> 7 == 1){ rneg=1 }
    if (inputBuff[32]>> 7 == 1){ sneg=1 }

    let total_size = 32 + 32 + 2 + 2 + rneg + sneg

    let buf = new Uint8Array(total_size+2)
    let i=0
    buf[i++]=0x30
    buf[i++]=total_size
    buf[i++]=0x02
    buf[i++]=32+rneg
    if(rneg==1){
        buf[i++]=0x00
    }
    for(let j=0;j<32;j++){
        buf[i++] = inputBuff[j]
    }

    buf[i++]=0x02
    buf[i++]=32+sneg
    if(sneg==1){
        buf[i++]=0x00
    }
    for(let j=32;j<64;j++){
        buf[i++] = inputBuff[j]
    }

    return buf.buffer
}

function posMod(a,b){
    let r = a % b
    if(r<0){ r += b}
    return r
}
// Returns the inverse of k modulo p.
// This function returns the only integer x such that (x * k) % p == 1.
// k must be non-zero and p must be a prime.
function inverse_mod(k, p){
    if (k == 0){ throw new Error('division by zero') }

    if (k < 0){
        // k ** -1 = p - (-k) ** -1  (mod p)
        return p - inverse_mod(-k, p)
    }

    // Extended Euclidean algorithm.
    var [s, old_s] = [BigInt(0), BigInt(1)]
    var [t, old_t] = [BigInt(1), BigInt(0)]
    var [r, old_r] = [p, k]

    while(r != 0){
        let quotient = old_r / r
        var [old_r, r] = [r, old_r - quotient * r]
        var [old_s, s] = [s, old_s - quotient * s]
        var [old_t, t] = [t, old_t - quotient * t]
    }

    let [gcd, x, y] = [old_r, old_s, old_t]

    if(gcd != 1n || posMod(k * x, p) != 1n){ throw new Error('inverseMod did not work gcd='+gcd+" f="+((k * x) % p))}

    return x % p
}

function is_on_curve(curve, x, y){
    return (y * y - x * x * x - curve.a * x - curve.b) % curve.p == 0
}


// see https://asecuritysite.com/encryption/ecdh3
// Returns the result of point1 + point2 according to the group law
function point_add(curve, x1, y1, x2, y2){
    if(!(x1 == null && y1 == null) && !is_on_curve(curve, x1,y1)){ throw new Error("P1 is not on the curve")}
    if(!(x2 == null && y2 == null) && !is_on_curve(curve, x2,y2)){ throw new Error("P2 is not on the curve")}

    if(x1 == null && y1 == null){
        // 0 + point2 = point2
        return [x2, y2]
    }

    if(x2 == null && y2 == null){
        // point1 + 0 = point1
        return [x1, y1]
    }

    if (x1 == x2 && y1 != y2){
        // point1 + (-point1) = 0
        return [null, null]
    }

    let m
    if(x1 == x2){
        // This is the case point1 == point2.
        m = (3n * x1 * x1 + curve.a) * inverse_mod(2n * y1, curve.p)
    } else {
        // This is the case point1 != point2.
        m = (y1 - y2) * inverse_mod(x1 - x2, curve.p)
    }

    let x3 = m * m - x1 - x2
    let y3 = y1 + m * (x3 - x1)
    let [resX, resY] = [posMod(x3, curve.p), posMod(-y3, curve.p)]

    if(!is_on_curve(curve, resX, resY)){ throw new Error("point add failed")}

    return [resX, resY]
}

// see https://asecuritysite.com/encryption/ecdh3
// Returns k * point computed using the double and point_add algorithm
function scalar_mult(curve, k, x, y){
    if(!(x == null && y == null) && !is_on_curve(curve, x, y)){ throw new Error("scalar_mult: the point must be on the ") }

    if(k % curve.n == 0n ||  (x == null && y == null)){
        return [null, null]
    }

    if(k < 0){
        // k * point = -k * (-point)
        return scalar_mult(curve, -k, -x, -y)
    }

    let result = [null, null]
    let addend = [x, y]

    while(k != 0){
        if(k % 2n == 1n){
            // Add.
            result = point_add(curve, result[0], result[1], addend[0], addend[1])
        }
        // Double. 

        addend = point_add(curve, addend[0], addend[1], addend[0], addend[1])

        k = k/2n
    }
    if(!is_on_curve(curve, result[0], result[1])){ throw new Error("scalar_mult: result is not on curve")}

    return result
}
// #endregion


export async function seed2D(seed, max){
    let hash = await crypto.subtle.digest("SHA-256", seed)
    let ret = bin.fromBigEndian(hash)
    if(max != undefined && max != null && max>0n){
        while(bin.fromBigEndian(hash) > max){
            hash = await crypto.subtle.digest("SHA-256", hash)
            ret = bin.fromBigEndian(hash)
        }
    }
    return ret
}


export async function sha256Str(buf) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((bytes) => bytes.toString(16).padStart(2, '0'))
      .join('');
    return hashHex;
  }

  export async function toPassword(rpId, username, salt, seed){
    const toHash = bin.concatAB(
        seed,
        bin.str2ab(username),
        bin.str2ab(rpId),
        bin.str2ab(salt))
    let sigRaw = await crypto.subtle.digest("SHA-256", toHash)
    let sigStr = passwordEncode(sigRaw)
    return sigStr
}

export function passwordEncode(s)
{
  let pwChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/-.,?!@#$%^&*()[]{}";
  let res = ""
  let sBuff = new Uint8Array(s)
  for(let i = 0; i<sBuff.length; i++){
    res += pwChars[ sBuff[i] % pwChars.length]
  }
  return res
}