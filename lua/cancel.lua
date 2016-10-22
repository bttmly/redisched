-- returns 1 if cancel succeeded, otherwise 0

local queue_key = "__REDIS_SCHED_DELAYED_QUEUE__"
local id_mapping_key = "__REDIS_SCHED_ID_TO_SCORE__"
local score_mapping_key = "__REDIS_SCHED_SCORE_TO_ID__"

local external_id = ARGV[1]

-- find the score of the job given the external_id
local score = redis.call("HGET", id_mapping_key, external_id)

-- couldn't find that id
if score == nil then
  return 0
end

-- redis.debug("external id", external_id, "score", score)

-- delete the id -> score mapping
redis.call("HDEL", id_mapping_key, external_id)

-- delete the score -> id mapping
redis.call("HDEL", score_mapping_key, score)

-- delete the job from the delayed queue
return redis.call("ZREMRANGEBYSCORE", queue_key, score, score)
