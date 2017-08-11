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

    await scheduler.put({ topic: "default", id: "id1", contents: "hello", delay: 0 });
    await wait(100);

    expect(await scheduler.pull("default")).toEqual({ id: "id1", contents: "hello" });

    await scheduler.put({ topic: "default", id: "id2", contents: "delayed", delay: 1 });
    expect(await scheduler.pull("default")).toBe(null);

    await wait(2000);
    expect(await scheduler.pull("default")).toEqual({ id: "id2", contents: "delayed" });

    await scheduler.put({ topic: "default", id: "id3", contents: "will_be_cancelled", delay: 0 });
    await wait(200);
    expect(await scheduler.readyCount("default")).toBe(1);

    expect(await scheduler.remove({ topic: "default", id: "id3" })).toBe(true);
    expect(await scheduler.readyCount("default")).toBe(0);

    expect(await scheduler.remove({ topic: "default", id: "id3" })).toBe(false);
  });

});
