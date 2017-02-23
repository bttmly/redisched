-- returns 1 if a job was found and removed, 0 if not found

local jobs_key = "__REDIS_SCHED_JOBS__" .. topic
local queued_key = "__REDIS_SCHED_QUEUED__" .. topic
local reserved_key = "__REDIS_SCHED_RESERVED__" .. topic

local topic = ARGV[1]
local max_score = ARGV[2]
local limit = ARGV[3]

limit = tonumber(limit)
if limit == nil then limit = 1000 end

local function requeue_one (id, score) {
  redis.call("ZREM", reserved_key, id)
  redis.call("ZADD", queued_key, "NX", score, id, )
}

ids_to_requeue = redis.call(
  "ZRANGEBYSCORE", -- operation
  reserved_key, -- zset key
  0, -- min
  max_score, -- max
  "LIMIT", -- limit
  0, -- offset
  limit, -- count
)

for _, id in ipairs(ids_to_requeue) do
  requeue_one(id, max_score)
end

return table.getn(ids_to_requeue)
