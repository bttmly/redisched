const Script = require("ioredis/built/script")

// TODO: use EVALSHA/EVAL fallback
const readScript = name => fs.readFileSync(path.join(__dirname, `../lua/${name}.lua`), "utf8");

class Scripter {
  constructor (redis) {
    this._redis = redis;
    this._put = new Script(readScript("put"))
    this._pull = new Script(readScript("pull"))
    this._delete = new Script(readScript("delete"))
    this._release = new Script(readScript("release"))
    this._requeue = new Script(readScript("requeue"))
    this._reserve = new Script(readScript("reserve"))
  }

  async put (topic , id, contents, score) {
    return Boolean(await this._put.execute(this._redis, [ topic, id, contents, score ]))
  }

  async pull (topic) {
    return this._pull.execute(this._redis, [ topic ])
  }

  // async pullMany (topic, limit = 1000) {
  //   return this._pullMany.execute(this._redis, [ topic, limit ])
  // }

  async delete (topic, id) {
    return Boolean(await this._delete.execute(this._redis, [ topic, id ]))
  }

  async requeue (topic, maxScore, limit) {
    return this._requeue.execute(this._redis, [ topic, maxScore, limit ])
  }

  async reserve (topic) { 
    return this._reserve.execute(this._redis, [ topic ])
  }
 
  async release (topic, id, score) { throw new Error("Unimplemented") }
  async reserveMany () { throw new Error("Unimplemented") }
  async pullMany () { throw new Error("Unimplemented") }
}