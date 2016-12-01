-- returns nil if no jobs ready, otherwise string

local queue_key = "__REDIS_SCHED_DELAYED_QUEUE__"
local id_mapping_key = "__REDIS_SCHED_ID_TO_SCORE__"
local score_mapping_key = "__REDIS_SCHED_SCORE_TO_ID__"

local max_score = ARGV[1]

-- redis.debug("max score:", max_score)

-- get an item from the delayed queue
local resp = redis.call(
  "ZRANGEBYSCORE",
  queue_key,
  0,
  max_score,
  "WITHSCORES",
  "LIMIT",
  0,
  1
)

-- redis.debug("got job", resp)

-- no jobs are ready, return nil
if table.getn(resp) == 0 then
  return nil
end

local job = resp[1]
local score = resp[2]

-- use the score to find the id
local external_id = redis.call("HGET", score_mapping_key, score)

-- delete the id -> score mapping
redis.call("HDEL", id_mapping_key, external_id)

-- delete the score -> id mapping
redis.call("HDEL", score_mapping_key, score)

-- delete the job from the delayed queue
redis.call("ZREM", queue_key, job)

return job
