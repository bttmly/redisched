const Redis = require("ioredis");
const Scheduler = require("../src/scheduler");

const wait = delay => new Promise(r => setTimeout(r, delay))

describe("scheduler", function () {
  let redis;
  let scheduler;
  beforeEach(function () {
    redis = new Redis();
    scheduler = new Scheduler(redis);
  });

  afterEach(function() {
    redis.disconnect();
  });

  it("works", function () {
    return scheduler.schedule("id1", "hello")
      .then(function (out) {
        console.log("out", out);
        return scheduler.get()
      })
      .then(function (job) {
        console.log("job", job)
        return scheduler.schedule("id2", "delayed", 500)
      })
      .then(function () {
        return wait(1000)
      })
      .then(function () {
        return scheduler.get()
      })
      .then(console.log);

  });

});
