const path = require("path");
const fs = require("fs");
const debug = require("debug")("node-scheduler");

const DEFAULTS = {
  requeueInterval: 1 * 1000, // 1 second,
  reserveInterval: 500, // 1/2 second
  ttr: 60 * 1000, // 1 minute
};

class Scheduler {
  constructor (redis, _options = {}) {
    this._redis = redis;
    this._subscriptions = Object.create(null);
    const options = Object.assign({}, DEFAULTS, _options);
    this._requeueInterval = options.requeueInterval;
    this._reserveInterval = options.reserveInterval;
    this._ttr = options.ttr;
    defineCommands(this._redis);
  }

  subscribe (topic, fn) {
    if (this._subscriptions[topic]) {
      throw new Error(`Topic ${topic} already subscribed`);
    }

    this._subscriptions[topic] = Promise.all([
      this._reserveLoop(topic, fn),
      this._requeueLoop(topic),
    ]);
  }

  async unsubscribe (topic) {
    if (!this.isSubscribed(topic)) return;
    await this._subscriptions[topic];
    delete this._subscriptions[topic];
  }

  isSubscribed (topic) {
    return !!this._subscriptions[topic];
  }

  async _reserveLoop (topic, handleJob) {
    try {
      while (this.isSubscribed(topic)) {
        const result = await this.reserve(topic);
        if (result == null) {
          await sleep(this._reserveInterval);
          continue;
        }
        handleJob({ topic, id: result[0], contents: result[1] });
      }
    } catch (err) {
      console.log(`error in reserve loop -- ${topic}: ${err.message}`);
      throw err;
    }
  }

  async _requeueLoop (topic) {
    try {
      while (this.isSubscribed(topic)) {
        const count = await this.requeue(topic);
        debug("requeued [%s %s] jobs", topic, count);
        await sleep(this._requeueInterval);
      }
    } catch (err) {
      console.log(`error in requeue loop -- ${topic}: ${err.message}`);
      throw err;
    }
  }

  reserve (topic) {
    const now = Date.now();
    debug("reserve [%s %s %s]", topic, now, this._ttr);
    return this._redis.__reserve(topic, now, this._ttr);
  }

  requeue (topic) {
    const now = Date.now();
    const limit = 1000;
    debug("requeue [%s %s %s]", topic, now, limit);
    return this._redis.__requeue(topic, now, limit);
  }

  put ({ topic, id, contents, delay }) {
    const score = Date.now() + (delay * 1000);
    return this._redis.__put(topic, id, contents, score);
  }

  remove ({ topic, id }) {
    return this._redis.__delete(topic, id);
  }

  release ({ topic, id, score }) {
    return this._redis.__release(topic, id, score);
  }
}

const readScript = name => fs.readFileSync(path.join(__dirname, `../lua/${name}.lua`), "utf8");

const scripts = {
  put: readScript("put"),
  delete: readScript("delete"),
  release: readScript("release"),
  requeue: readScript("requeue"),
  reserve: readScript("reserve"),
};

function defineCommands (redis) {
  Object.keys(scripts).forEach(function (name) {
    redis.defineCommand(`__${name}`, {
      numberOfKeys: 0,
      lua: scripts[name],
    });
  });
  return redis;
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = Scheduler;
