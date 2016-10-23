# redisched

Lua scripts that implement a simple, cancellable, delayed-job interface on top of Redis. Also includes a basic Node.js client that uses these scripts via the Redis [`EXEC`](http://redis.io/commands/exec) command. However, The Lua scripts are general-purpose can be used by a client written in any programming language. Many common Redis clients expose an ergonomic interface for scripting.

### Scripts/methods

- `schedule(id: string, body: string, expiration: number): number`
Schedules a job to run at the expiration time. A client might expose this as 'delay' and add that argument to the current time stamp. The id can be used to cancel the job before it runs. Returns `1` if the job is successfully added, otherwise `0`.

- `cancel(id: string): number`
Cancels the job with the given id. Returns `1` if a job was cancelled, otherwise `0`

- `get(): string?`
Gets a single job which has passed it's expiration time. If there is a ready job, returns it as a string, otherwise returns `nil`

### Configuration
The Lua scripts use three keys to store data: a sorted set for the jobs themselves and two hashes for mapping between ids and sorted set scores. The initial values are `__REDIS_SCHED_DELAYED_QUEUE__`, `__REDIS_SCHED_ID_TO_SCORE__`, `__REDIS_SCHED_SCORE_TO_ID__` and can be configured by simple string replacement on the script.

### Rationale
This behavior is *almost* possible to implement entirely on the client side. The issue is that it's not possible to find a job by it's externally supplied id and remove it from the sorted set in a single round trip. This opens the door for races where two clients end up consuming the same job. The necessity for supporting externally supplied ids is that it allows job producers to carry less state. For instance, upon user sign up you might schedule a job with id `need_help_email:<userid>` to run a few days later. However, if in that time the user performs some action that causes the email to be unnecessary, the producer knows it can cancel a job with the specific id `need_help_email:<userid>`. This is preferable to the other situation, where the scheduler responds to the application with the id of the new job -- the application must record that id somewhere and map it to that user's id. Systems like [Disque](https://github.com/antirez/disque) and [Beanstalkd](https://github.com/kr/beanstalkd) both return the id of the created job, forcing the job producer to store that somewhere if it might be cancelled later.
