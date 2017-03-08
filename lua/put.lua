-- returns 1 if job put successfully, 0 otherwise (i.e. duplicate id)
local topic, id, body, score = unpack(ARGV)

local jobs_key = "__REDIS_SCHED_JOBS__" .. topic
local queued_key = "__REDIS_SCHED_QUEUED__" .. topic

local did_add = redis.call("ZADD", queued_key, "NX", score, id)
if did_add == 0 then return 0 end

redis.call("HSET", jobs_key, id, body)

return 1
