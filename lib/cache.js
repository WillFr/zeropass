"use strict"


export class Cache {
  constructor(){
    var data = {}
    this.data={}

    setInterval(function(){
      let toDel = []
      for(const [key, value] of Object.entries(data)){
        if('ttl' in value && value['ttl']<Date.now()){
          toDel.push(key)
        }
      }
      toDel.forEach(x => delete data[x])
    }, 1000)
  }

  getDel(key){
    let val = this.data[key]
    delete this.data[key]
    return val
  }

  set(key, val, ttl){
    this.data[key] = { val: val, ttl: ttl}
  }

  get(key){
    return this.data[key].val
  }
}

export const globalCache = new Cache()