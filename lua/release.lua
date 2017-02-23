-- returns 1 if a job was found and removed, 0 if not found

local topic = ARGV[1]
local id = ARGV[2]
local score = ARGV[3]

local jobs_key = "__REDIS_SCHED_JOBS__" .. topic
local queued_key = "__REDIS_SCHED_QUEUED__" .. topic
local reserved_key = "__REDIS_SCHED_RESERVED__" .. topic

-- check if job was reserved; if not, don't need to continue
-- this would happen if
-- a.) the job never existed
-- b.) the job was previously deleted
-- c.) the job was reserved but had timed out and been requeued
local result = redis.call("ZREM", reserved_key, id)
if result == 0 then
  return 0
end

-- sanity check; if id was in the reserved set, the job should exist
result = redis.call("HEXISTS", jobs_key, id)
if result == 0 then
  return redis.error_response(string.format("id %s in reserved set but job not found", id))
end

-- sanity check; if ZADD NX returns 0 here then we are in an inconsistent state
-- since ZADD NX == 0 means the id was already in the queued set and we already
-- are sure from the ZREM above that the id was in the reserved set
result = redis.call("ZADD", queued_key, "NX", score, id)
if result == 0 then
  return redis.error_response(string.format("id %s both reserved and queued", id))
end

return 1
