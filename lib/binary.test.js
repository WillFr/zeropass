import * as binary from './binary.js'

test('test copy at',() => {
    let bigBuff = [1,2,3,4,5,6,7,8,9]
    let smallBuff = ['a', 'b', 'c']

    let i = binary.copyAt(bigBuff, smallBuff, 2)
    expect(JSON.stringify(bigBuff) == JSON.stringify([1,2,'a', 'b', 'c',6,7,8,9]))
    expect(i==5)

    let err = null
    try{
        binary.copyAt(bigBuff, (new Uint8Array(2)).buffer, 0)
    } catch(er){
        err = er
    }
    expect(err != null)
})