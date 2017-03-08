-- returns 1 if a job was found and removed, 0 if not found
local topic, id = unpack(ARGV)

local jobs_key = "__REDIS_SCHED_JOBS__" .. topic
local queued_key = "__REDIS_SCHED_QUEUED__" .. topic
local reserved_key = "__REDIS_SCHED_RESERVED__" .. topic

local jobs_del = redis.call("HDEL", jobs_key, id)
local queued_del = redis.call("ZREM", queued_key, id)
local reserved_del = redis.call("ZREM", reserved_key, id)

-- job was not present at all
if (jobs_del == 0 and queued_del == 0 and reserved_del == 0) then
  return 0
-- job was queued
elseif (jobs_del == 1 and queued_del == 1 and reserved_del == 0) then
  return 1
-- job was reserved
elseif (jobs_del == 1 and queued_del == 0 and reserved_del == 1) then
  return 1
-- we somehow got into an inconsistent state:
-- either job was BOTH queued AND reserved OR
-- job was in NEITHER queued NOR reserved
else
  return redis.error_reply("inconsistent job state -- ", jobs_del, queued_del, reserved_del)
end
