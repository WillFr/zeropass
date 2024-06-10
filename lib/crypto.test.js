import * as cryptolib from '../lib/crypto.js'
import * as binary from '../lib/binary.js'


test('should transform a byte array into a password', function() {
  let b = new Uint8Array(2)
  b[0] = 0
  b[1] = 1
  let pw = cryptolib.passwordEncode(b.buffer)
  expect(pw == "AB");
});

test('should encrypt and decrypt', async function() {
  let seed = await crypto.subtle.digest("SHA-256", binary.str2ab("test"))
  let toEncrypt = "webauthn.io"
  let encrypted = await cryptolib.data2Encrypted(toEncrypt, seed)
  expect(encrypted != toEncrypt)
  let decrypted = await cryptolib.encrypted2Data(encrypted, seed)
  expect(decrypted == toEncrypt);
})

test('Convert Uint8Array to string', ()=> {
  let arr = new Uint8Array([0, 1, 2, 3, 4])
  let res = binary.uint8Arr2str(arr)
  expect(res == "0 1 2 3 4")
})