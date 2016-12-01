-- returns result of ZADD (so 1 for success)

local queue_key = "__REDIS_SCHED_DELAYED_QUEUE__"
local id_mapping_key = "__REDIS_SCHED_ID_TO_SCORE__"
local score_mapping_key = "__REDIS_SCHED_SCORE_TO_ID__"

local external_id = ARGV[1]
-- bodies should be unique. if a repeat is encountered, it will be rejected
local body = ARGV[2]
local score = ARGV[3]

-- scores MUST BE UNIQUE!, so scan forward to find the next available score
-- clients should implement their scores such that they are unlikely to collide
while true do
  local exists = redis.call("HEXISTS", score_mapping_key, score)
  if exists == 0 then break end
  score = score + 1
end

-- set the mapping of external_id to internal_id (which is just the zset score)
redis.call("HSET", id_mapping_key, external_id, score)

-- set the reverse mapping. this is so we can remove the original
-- mapping when we only have the score
redis.call("HSET", score_mapping_key, score, external_id)

-- put the job into the zset; NX option ensures we don't update an existing job
-- if a job with the same body already exists, this will return 0 so the client
-- will know the "SCHEDULE" did not succeed
return redis.call("ZADD", queue_key, "NX", score, body)
