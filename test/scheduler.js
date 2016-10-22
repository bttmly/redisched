const Redis = require("ioredis");
const expect = require("expect");

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
    return Promise.resolve()
      // check immediate job
      .then(function () {
        return scheduler.schedule("id1", "hello")
      })
      .then(function (out) {
        return scheduler.get().then(job => expect(job).toBe("hello"))
      })
      // check a delayed job
      .then(function () {
        return scheduler.schedule("id2", "delayed", 100)
      })
      .then(function () {
        return scheduler.get().then(job => expect(job).toBe(null))
      })
      .then(function () {
        return wait(200).then(() => scheduler.get())
      })
      .then(function (job) {
        expect(job).toBe("delayed");
      })
      // check cancellation
      .then(function () {
        return scheduler.schedule("id3", "cancelled").then(() => scheduler.readyCount())
      })
      .then(function (count) {
        expect(count).toBe(1);
        return scheduler.cancel("id3").then(() => scheduler.readyCount())
      })
      .then(function (count) {
        expect(count).toBe(0);
      });
    });

});
