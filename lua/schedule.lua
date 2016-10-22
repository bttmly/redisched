-- returns result of ZADD (so 1 for success)

local queue_key = "__REDIS_SCHED_DELAYED_QUEUE__"
local id_mapping_key = "__REDIS_SCHED_ID_TO_SCORE__"
local score_mapping_key = "__REDIS_SCHED_SCORE_TO_ID__"

-- we only have millisecond granularity for now

local external_id = ARGV[1]
local body = ARGV[2]
local delay = tonumber(ARGV[3])
local millis = tonumber(ARGV[4])

-- redis.debug("stuff:", external_id, body, delay, millis)

local score = tostring(millis + delay)

-- set the internal mapping of external_id to internal_id
-- (which is just the zset score)
redis.call("HSET", id_mapping_key, external_id, score)

-- set the reverse mapping. this is so we can remove the original
-- mapping
redis.call("HSET", score_mapping_key, score, external_id)

-- put the job into the zset
return redis.call("ZADD", queue_key, score, body)
