-- returns result of ZADD (so 1 for success)

local queue_key = "delayed_queue"
local id_mapping_key = "external_id_to_score"
local score_mapping_key = "score_to_external_id"

-- we only have millisecond granularity for now
local millis = redis.call("TIME")

local external_id = ARGV[1]
local body = ARGV[2]
local delay = ARGV[3]
local score = millis + delay

-- set the internal mapping of external_id to internal_id
-- (which is just the zset score)
redis.call("HSET", id_mapping_key, external_id, score)

-- set the reverse mapping. this is so we can remove the original
-- mapping
redis.call("HSET", score_mapping_key, score, external_id)

-- put the job into the zset
return redis.call("ZADD", queue_key, score, body)
