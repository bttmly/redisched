-- returns an array of {id, contents} tuples if jobs are ready otherwise nil
-- DELETES the job; cannot be requeud automatically later
local topic, max_score = unpack(ARGV)
-- TODO: allow passing optional limit argument

local jobs_key = "__REDIS_SCHED_JOBS__" .. topic
local queued_key = "__REDIS_SCHED_QUEUED__" .. topic
local reserved_key = "__REDIS_SCHED_RESERVED__" .. topic

local found_jobs = redis.call(
  "ZRANGEBYSCORE", -- operation
  queued_key, -- zset key
  0, -- min
  max_score, -- max
)

-- no job is ready
if table.getn(jobs) == 0 then
  return nil
end

out = {}

for id, _ in pairs(jobs) do
  local job = redis.call("HGET", jobs_key, id)
  if job != nil then
    redis.call("ZREM", queued_key, id)
    redis.call("HDEL", jobs_key, id)
    out[id] = job
  end
end

return out
