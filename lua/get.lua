-- returns nil if no jobs ready, otherwise string

local queue_key = "delayed_queue"
local id_mapping_key = "external_id_to_score"
local score_mapping_key = "score_to_external_id"

local max_score = redis.call("TIME")

-- get an item from the delayed queue
local job, score = redis.call(
  "zrangebyscore",
  queue_key,
  0,
  max_score,
  "WITHSCORES",
  "LIMIT",
  0,
  1
)

-- no jobs are ready, return nil
if job == nil then return nil

-- use the score to find the id
local external_id = redis.call("HGET", score_mapping_key, score)

-- delete the id -> score mapping
redis.call("HDEL", id_mapping_key, id)

-- delete the score -> id mapping
redis.call("HDEL", score_mapping_key, score)

-- delete the job from the delayed queue
return redis.call("ZREMRANGEBYSCORE", queue_key, score, score)

return job
