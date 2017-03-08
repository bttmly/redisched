const Redis = require("ioredis");
const expect = require("expect");

const Scheduler = require("./scheduler");

const wait = delay => new Promise(r => setTimeout(r, delay));

describe("scheduler", function () {
  let redis;
  let scheduler;
  beforeEach(function () {
    redis = new Redis();
    scheduler = new Scheduler(redis);
  });

  afterEach(async function () {
    await redis.flushdb();
    return redis.disconnect();
  });

  it("works", async function () {
    throw new Error("TODO -- need to update test w/ new API");

    await scheduler.put("id1", "hello");
    expect(await scheduler.get()).toBe("hello");

    await scheduler.put("id2", "delayed", 100);
    expect(await scheduler.get()).toBe(null);

    await wait(200);
    expect(await scheduler.get()).toBe("delayed");

    await scheduler.put("id3", "will_be_cancelled");
    await wait(200);
    expect(await scheduler.readyCount()).toBe(1);

    await scheduler.cancel("id3");
    expect(await scheduler.readyCount()).toBe(0);
  });

});
