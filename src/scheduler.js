const path = require("path");
const fs = require("fs");

const scriptDir = path.join(__dirname, "../lua");

const getScript = fs.readFileSync(path.join(scriptDir, "get.lua"), "utf8")
const cancelScript = fs.readFileSync(path.join(scriptDir, "cancel.lua"), "utf8")
const scheduleScript = fs.readFileSync(path.join(scriptDir, "schedule.lua"), "utf8")

class Scheduler {
  constructor (redis) {
    this._redis = redis;
    this._cancelScript = cancelScript;
    this._scheduleScript = scheduleScript;
    this._getScript = getScript
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

  get () {
    return this._redis.schedulerGet(Date.now());
  }

  schedule (id, body, delay = 0) {
    return this._redis.schedulerSchedule(id, body, delay, Date.now())
  }

  cancel (id) {
    return this._redis.schedulerCancel(id)
  }

  readyCount () {
    const key = "__REDIS_SCHED_DELAYED_QUEUE__"
    return this._redis.zrangebyscore(key, 0, Date.now())
      .then(data => data.length);
  }
}

module.exports = Scheduler;
