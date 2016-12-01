const Redis = require("ioredis");
const expect = require("expect");

const Scheduler = require("./scheduler");

const count = Number(process.argv[2]);

const redis = new Redis();
const sched = new Scheduler(redis);

const items = Array(count)
  .fill(0)
  .map((_, i) => i)

const putStart = Date.now();

let putted = 0;
let gotten = 0;

put(items)
  .then(function () {
    const diff = Date.now() - putStart;
    console.log(`put completed ${putted} jobs in ${diff} ms; ${1000 * count / diff} puts per second`);
    return redis.zcount("__REDIS_SCHED_DELAYED_QUEUE__", "-inf", "+inf").then(count => console.log("STORED COUNT", count));
  })
  .then(function () {
    const getStart = Date.now();
    return get().then(function () {
      const diff = Date.now() - putStart;
      console.log(`get completed ${gotten} ${diff} ms; ${1000 * gotten / diff} gets per second`)
      return redis.zcount("__REDIS_SCHED_DELAYED_QUEUE__", "-inf", "+inf").then(count => console.log("STORED COUNT", count));
    });
  })
  .then(() => redis.disconnect())



function put (xs) {

  function loop() {
    const x = xs.shift();
    if (x == null) return;

    return sched.schedule(x, x, -100000).then(function () {
      putted++;
      return loop();
    });
  }

  return loop();
}

function get () {
  return sched.get().then(function (job) {

    if (job == null) {
      return;
    }

    gotten++;
    return get();
  });
}
