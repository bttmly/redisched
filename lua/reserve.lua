-- returns an {id, contents} tuple if a job is ready otherwise nil
local topic max_score, ttr = unpack(ARGV)

local jobs_key = "__REDIS_SCHED_JOBS__" .. topic
local queued_key = "__REDIS_SCHED_QUEUED__" .. topic
local reserved_key = "__REDIS_SCHED_RESERVED__" .. topic

redis.debug("max_score", max_score);

local found_job = redis.call(
  "ZRANGEBYSCORE", -- operation
  queued_key, -- zset key
  0, -- min
  max_score, -- max
  "LIMIT", -- limit
  0, -- offset
  1 -- count
)

-- no job is ready
if table.getn(found_job) == 0 then
  return nil
end

local id = found_job[1]
local job = redis.call("HGET", jobs_key, id)

-- sanity check
if job == nil then
  return redis.error_response(string.format("found queued id %s but no job", id))
end

redis.call("ZREM", queued_key, id)
redis.call("ZADD", reserved_key, max_score + ttr, id)

return {id, job}
