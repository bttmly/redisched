const path = require("path");
const fs = require("fs");

const readScript = name => fs.readFileSync(path.join(__dirname, `../lua/${name}.lua`), "utf8")
const getScript = readScript("get");
const cancelScript = readScript("cancel");
const scheduleScript = readScript("schedule");

const defaultKeys = {
  queue: "__REDIS_SCHED_DELAYED_QUEUE__",
  idMapping: "__REDIS_SCHED_ID_TO_SCORE__",
  scoreMapping: "__REDIS_SCHED_SCORE_TO_ID__",
};

const scriptNames = ["_cancelScript", "_scheduleScript", "_getScript"];

class Scheduler {
  constructor (redis) {
    this._redis = redis;
    this._cancelScript = cancelScript;
    this._scheduleScript = scheduleScript;
    this._getScript = getScript;
    this._keys = Object.create(defaultKeys);
    this._defineCommands();
  }

  get () {
    return this._redis.schedulerGet(Date.now());
  }

  schedule (id, body, delay = 0) {
    const expiry = Date.now() + delay;
    return this._redis.schedulerSchedule(id, body, expiry)
  }

  cancel (id) {
    return this._redis.schedulerCancel(id)
  }

  readyCount () {
    return this._redis.zrangebyscore(this._keys.queue, 0, Date.now())
      .then(data => data.length);
  }

  _defineCommands () {
    this._redis.defineCommand("schedulerSchedule", {
      numberOfKeys: 0,
      lua: this._scheduleScript,
    });
    this._redis.defineCommand("schedulerGet", {
      numberOfKeys: 0,
      lua: this._getScript,
    });
    this._redis.defineCommand("schedulerCancel", {
      numberOfKeys: 0,
      lua: this._cancelScript,
    });
  }

  replaceKey (which, newVal) {
    const oldVal = this._keys[which];
    if (oldVal == null) return;

    scriptNames.forEach(function (name) {
      this[name] = this[name].replace(oldVal, newVal);
    });
    this._keys[which] = newVal;
    this._defineCommands();
  }
}

module.exports = Scheduler;
