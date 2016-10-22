const path = require("path");
const fs = require("fs");

const scriptDir = path.join(__dirname, "../lua");

const getScript = fs.readFileSync(path.join(scriptDir, "get.lua"), "utf8")
const cancelScript = fs.readFileSync(path.join(scriptDir, "cancel.lua"), "utf8")
const schedule = fs.readFileSync(path.join(scriptDir, "schedule.lua"), "utf8")

class Scheduler {
  constructor (redis) {
    this._redis = redis;
  }
}
