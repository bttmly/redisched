-- returns a number representing number of jobs requeued
local topic, max_score, limit = unpack(ARGV)

local jobs_key = "__REDIS_SCHED_JOBS__" .. topic
local queued_key = "__REDIS_SCHED_QUEUED__" .. topic
local reserved_key = "__REDIS_SCHED_RESERVED__" .. topic

limit = tonumber(limit)
if limit == nil then limit = 1000 end

-- get the ids of up to `limit` jobs from the reserved set that have timed out
local ids_to_requeue = redis.call(
  "ZRANGEBYSCORE", -- operation
  reserved_key, -- zset key
  0, -- min
  max_score, -- max
  "LIMIT", -- limit
  0, -- offset
  limit -- count
)

-- shift all the ids we found from the reserved set into the queue
for _, id in ipairs(ids_to_requeue) do
  -- remove a job from reserved and put it into the queue. ZADD NX should never
  -- return 0, which would indicate the job was already in the queue
  redis.call("ZREM", reserved_key, id)
  redis.call("ZADD", queued_key, "NX", max_score, id)
end

-- return an integer representing number of jobs requeued
return table.getn(ids_to_requeue)
