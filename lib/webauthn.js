"use strict"

import * as binary from "./binary.js"
import { signAlgo } from "./util.js"
import * as cryptolib from "./crypto.js"

export let authAAGUID = "8beb894e-11da-44"

// see: https://w3c.github.io/webauthn/#sctn-authenticator-data
export async function generateAuthenticatorData(rpID, attestedCredentialData){
    let acdLen = 0
    let acdArr = new Uint8Array(0)
    if(attestedCredentialData != null) {
      acdLen = attestedCredentialData.byteLength
      acdArr = new Uint8Array(attestedCredentialData)
    }
    let view = new Uint8Array(32 + 1 + 4 + acdLen)
  
    let rpIdH=new Uint8Array(await crypto.subtle.digest("SHA-256", binary.str2ab(rpID)))
    let i=0
    for(let j=0; j<rpIdH.length; j++){
      view[i++] = rpIdH[j]
    }
  
    if(acdLen==0){
      view[i++] = 0b00000001;
    } else {
      view[i++] = 0b01000001;
    }
  
    // TODO : this is the sig counter
    view[i++]= 0;
    view[i++]= 0;
    view[i++]= 0;
    view[i++]= 0;
  
    for(let j=0; j<acdLen; j++){
      view[i++]=acdArr[j]
    }
  
    return view.buffer
}

export function padCredId(credId){
  let credIdArr = new Uint8Array(Math.max(16, credId.byteLength)) 
  let i = binary.copyAt(credIdArr, new Uint8Array(credId), 0)
  for(;i<credIdArr.length;i++){
    credIdArr[i] = 1
  }
  return credIdArr
}
  
  // see https://w3c.github.io/webauthn/#sctn-attested-credential-data
export async function generateAttestedCredentialData(aaguid, credIdArr, key){
    let aaguidArr = new Uint8Array(aaguid)
    let arr = new Uint8Array(16 + 2 + credIdArr.length + 77)
    let i = 0
    for(let j=0; j<16; j++){
      arr[i++] = aaguidArr[j]
    }
    arr[i++] = credIdArr.length >> 8
    arr[i++] = credIdArr.length<<8>>8
    for(let j=0; j<credIdArr.length; j++){
      arr[i++] = credIdArr[j]
    }
    
    // manual cbor because js does not like int as keys
    // great resource : https://dev.to/mnelsonwhite/deserialising-cbor-encoded-data-in-net-5cgo#table-3
    arr[i++] = 0xA5 // 1010_0101 -> type map with 5 element
    arr[i++] = 0x01 // 0000_0001 -> 1 -> key type 
    arr[i++] = 0x02 // 0000_0010 -> 2 -> EC2 key type
    arr[i++] = 0x03 // 0000_0011 -> 3 -> algo
    arr[i++] = 0x26 // 0010_0110 -> -7 ->ES256
    arr[i++] = 0x20 // 0010_0000 -> -1 -> curve
    arr[i++] = 0x01 // 0000_0001 -> 1 -> P256
    
    let jwk = await crypto.subtle.exportKey("jwk", key)
    let keyx = new Uint8Array(binary.str2ab(binary.fromB64URL(jwk.x)))
    arr[i++] = 0x21 // 0010_0001 -> -2 -> x
    arr[i++] = 0x58 // 0101_1000 -> byte string with length on 8 bits
    arr[i++] = keyx.length
    for(let j=0; j<keyx.length; j++){
      arr[i++] = keyx[j]
    }
  
    let keyy = new Uint8Array(binary.str2ab(binary.fromB64URL(jwk.y)))
    arr[i++] = 0x22 // 0010_0010 -> -3 -> y
    arr[i++] = 0x58 // 0101_1000 -> byte string with length on 8 bits
    arr[i++] = keyy.length
    for(let j=0; j<keyy.length; j++){
      arr[i++] = keyy[j]
    }
    
    return arr.buffer
}

export async function generateAttestationData(fmt, clientData, authData, privateKey){
    if (fmt==undefined || fmt == "none") {
        return CBOR_AttesData({'fmt': 'none', 'attStmt': {}, 'authData': new Uint8Array(authData)})
    } else {
        let clientDataHash = await crypto.subtle.digest("SHA-256", binary.str2ab(JSON.stringify(clientData)))
        let toSign = binary.concatAB(authData, clientDataHash)
        let rawSig = await crypto.subtle.sign(signAlgo, privateKey, toSign)
        let attesSig = cryptolib.ECDSASigtoDER(rawSig)

        let cborData = CBOR_AttesData({'fmt': 'packed', 'attStmt': {"alg": -7, "sig": new Uint8Array(attesSig) }, 'authData': new Uint8Array(authData)})
        return cborData
    }
}


// see https://cbor.me/
// see https://dev.to/mnelsonwhite/deserialising-cbor-encoded-data-in-net-5cgo#table-3
function CBOR_AttesData(data){
  let fmt = data.fmt
  let attesSig = data.attStmt.sig
  let authData = data.authData
  let alg = data.attStmt.alg

  let bufAttes = new Uint8Array(attesSig)
  let bufAuthD = new Uint8Array(authData)
  let ret = new Uint8Array(bufAttes.length + bufAuthD.length + 200)

  let i=0
  ret[i++]=0xa3 // Map of 3 element
  ret[i++]=0x63 // text of length 3
  ret[i++]=0x66 // text[0] f
  ret[i++]=0x6d // text[0] m
  ret[i++]=0x74 // text[0] t
  ret[i++]= (6 << 4) + fmt.length // text of length fmt.length
  for(let j=0; j<fmt.length;j++){
    ret[i++]=fmt.charCodeAt(j)
  }

  ret[i++]=0x67 // text of length 7
  ret[i++]=0x61 // text[0] a
  ret[i++]=0x74 // text[1] t
  ret[i++]=0x74 // text[2] t
  ret[i++]=0x53 // text[3] S
  ret[i++]=0x74 // text[4] t
  ret[i++]=0x6d // text[5] m
  ret[i++]=0x74 // text[6] t

  if(fmt=="packed"){
    ret[i++]=0xa2 // map of 2 elements
    ret[i++]=0x63 // text of length 3
    ret[i++]=0x61 // text[0] a
    ret[i++]=0x6c // text[1] l
    ret[i++]=0x67 // text[2] g

    if(alg<0){ ret[i++]=(0x2<<4)-(alg>>>0)-1}
    else { ret[i++]=alg}

    ret[i++]=0x63 // text of length 3
    ret[i++]=0x73 // text[0] s
    ret[i++]=0x69 // text[1] i
    ret[i++]=0x67 // text[2] g

    ret[i++]=0x58 // bytestring with length on 8 bits
    ret[i++]=bufAttes.length
    i = binary.copyAt(ret, bufAttes, i)
  } else if (fmt=="none") {
    ret[i++]=0xa0 // map of 2 elements
  }

  ret[i++]=0x68 // text of length 8
  ret[i++]=0x61 // text[0] a
  ret[i++]=0x75 // text[1] u
  ret[i++]=0x74 // text[2] t
  ret[i++]=0x68 // text[3] h
  ret[i++]=0x44 // text[4] D
  ret[i++]=0x61 // text[5] a
  ret[i++]=0x74 // text[6] t
  ret[i++]=0x61 // text[7] a

  ret[i++]=0x58 // bytestring with length on 8 bits
  ret[i++]=bufAuthD.length
  i = binary.copyAt(ret, bufAuthD, i)

  let retSized = new Uint8Array(i)
  binary.copyAt(retSized, ret,0)
  return retSized.buffer
}
