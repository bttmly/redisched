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

const queue_key = "__REDIS_SCHED_DELAYED_QUEUE__"
const id_mapping_key = "__REDIS_SCHED_ID_TO_SCORE__"
const score_mapping_key = "__REDIS_SCHED_SCORE_TO_ID__"

put(items)
  .then(function () {
    const diff = Date.now() - putStart;
    console.log(`put completed ${putted} jobs in ${diff} ms; ${1000 * count / diff} puts per second`);
    return logKeys();
  })
  .then(function () {
    const getStart = Date.now();
    return get().then(function () {
      const diff = Date.now() - putStart;
      console.log(`get completed ${gotten} ${diff} ms; ${1000 * gotten / diff} gets per second`)
      return logKeys();
    });
  })
  .then(() => {



    return redis.disconnect()
  })


function logKeys () {
  return Promise.all([
    redis.zcount(queue_key, "-inf", "+inf").then(count => console.log("STORED COUNT", count)),
    redis.hlen(id_mapping_key).then(count => console.log("id mapping key remaining", count)),
    redis.hlen(score_mapping_key).then(count => console.log("score key remaining", count)),
  ])
}


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
