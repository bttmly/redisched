-- returns 1 if cancel succeeded, otherwise 0

local queue_key = "delayed_queue"
local id_mapping_key = "external_id_to_score"

local external_id = ARGV[1]

-- find the score of the job given the external_id
local score = redis.call("HGET", id_mapping_key, external_id, score)

-- couldn't find that id
if score == nil then return 0

-- delete the id -> score mapping
redis.call("HDEL", id_mapping_key, external_id)

-- delete the score -> id mapping
redis.call("HDEL", score_mapping_key, score)

-- delete the job from the delayed queue
return redis.call("ZREMRANGEBYSCORE", queue_key, score, score)
