const path = require("path");
const fs = require("fs");
const debug = require("debug")("node-scheduler");

const REQUEUE_INTERVAL = 5 * 1000; // 5 seconds
const RESERVE_INTERVAL = 500; // 1/2 second

class Scheduler {
  constructor (redis) {
    this._redis = redis;
    this._subscriptions = new Set();
    defineCommands(this._redis);
  }

  // could this be implemented as an async generator?
  subscribe (topic, fn) {
    if (this._subscriptions.has(topic)) {
      throw new Error(`Topic ${topic} already subscribed`);
    }
    this._subscriptions.add(topic);

    return Promise.all([
      this._reserveLoop(topic, fn),
      this._requeueLoop(topic),
    ]);
  }

  unsubscribe (topic) {
    return this._subscriptions.delete(topic);
  }

  isSubscribed (topic) {
    return this._subscriptions.has(topic);
  }

  _reserveLoop (topic, fn) {
    return new Promise(resolve => {
      const _loop = () => {
        if (!this.isSubscribed(topic)) return resolve();
        this._reserve(topic).then(result => {
          if (result == null) {
            if (!this.isSubscribed(topic)) return resolve();
            return setTimeout(_loop, RESERVE_INTERVAL);
          }

          const job = JSON.parse(result);
          job.topic = topic;
          fn(job);
          _loop();
        });
      };

      _loop();
    });
  }

  _requeueLoop (topic) {
    return new Promise(resolve => {
      const _loop = () => {
        if (!this.isSubscribed(topic)) return resolve();
        this._requeue(topic).then(count => {
          debug("requeued", count);
          // don't want to wait until start of next loop to check this
          if (!this.isSubscribed(topic)) return resolve();
          setTimeout(_loop, REQUEUE_INTERVAL);
        });
      };

      _loop();
    });
  }

  async _reserve (topic) {
    const now = Date.now();
    const ttr = 10 * 60 * 1000; // long TTR of 10 minutes
    return this._redis.__reserve(topic, now, ttr);
  }

  async _requeue (topic) {
    const now = Date.now();
    const limit = 1000;
    return this._redis.__requeue(topic, now, limit);
  }

  async put ({ topic, id, contents, delay }) {
    const score = Date.now() + (delay * 1000);
    return this._redis.__put(topic, id, contents, score);
  }

  async cancel ({ topic, id }) {
    return this._redis.__delete(topic, id);
  }

  async release ({ topic, id, score }) {
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
      numerOfKeys: 0,
      lua: scripts[name],
    });
  });
  return redis;
}

module.exports = Scheduler;