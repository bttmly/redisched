# redisched

## What is this?
A programming language-agnostic job queue implementation backed by Redis. The bulk of the logic of this system lives in Lua scripts that can be used by any Redis client that supports scripting. In addition, for a given programming language or platform, a bit of glue code must be written to wire the whole thing together. Further, it will be up to you to attach some kind of networking interface to the system so it can receive and dispatch jobs.

## Why would I use it?
The biggest motivating factor, and functional difference from work queues like Beanstalkd or Disque is that `redisched` jobs have a client-provided identifier, and can be accessed or deleted by that identifier. This would be particularly useful if an application has some kind of well-known identifying scheme. For example, upon user sign up an email job is scheduled for three days later, with the identifier `need_some_help_email_<user_id>`. Now if the user completes some significant action before the three days are up, we can just delete the job with the id `need_some_help_email_<user_id>`.

Further, apart from a very small bit of easily-debuggable glue code, its *just Redis*. Redis is a fast, widely-used, and well-vetted piece of software with clients in virtually every programming language out there.

## How do I use it?
This repository contains two implementations, one for [Node.js](https://github.com/bttmly/redisched/blob/master/node/scheduler.js) and the other in [Go](https://github.com/bttmly/redisched/blob/master/golang/scheduler.go). These can be used as is and hooked up to whatever networking system you choose -- for instance, it is trivial to have the Scheduler receive jobs from a RabbitMQ instance and dispatch them when ready to a web hook. For other platforms, you will need to implement the Scheduler by hand, which should be straightforward. This repo contains a small web frontend for sending and receiving jobs. From the project root, you can start it with `node frontend` and head to `localhost:7171`. You'll want to have Redis running, along with one of the scheduler server implementations. They have the same interface so the web frontend can use either. To run the Go server do `go run golang/main.go golang/scheduler.go` (assuming this repo is cloned in the right place regarding `$GOPATH`). Alternately, the Node server can be run with `node node/server` (be sure to run `npm install` in both `frontend` and `node` directories).

## Implementing a scheduling server
There are five key scheduling operations, three of which are "active" (i.e. a client initiates them) and two of which are "passive" (i.e. they happen in the background, on a loop). The active operations are `PUT` (add a job), `DELETE` (remove a job), and `RELEASE` (requeue a single job). The background operation is `REQUEUE` (requeues all reserved jobs which have timed out). `RESERVE` is the operation to get a job, and can be called either passively or actively. This largely depends on how the scheduler is used -- for instance if it is acting as a "push" service (POST-ing data to a web hook for example) then the scheduler would probably run `RESERVE` in a loop and fire off an HTTP request whenever a job becomes available. On the other hand, if it is acting as a "pull" service (receiving inbound requests for ready jobs) then `RESERVE` would just be called when a client asked for a job. As a rough measure, basic Node.js and Go implementations of this system are around 100-200 lines of code.

### API
`reserve(topic: String, max: Number, ttr: Number)` -- get a job with expiration less than `max`; the job is put in the reserved queue to be requeued after `ttr` seconds if it is not `released` before then.

`pull(topic: String, max: Number)` -- get a job with expiration less than `max`; the job is NOT reserved, it is deleted immediately

`put(topic: String, id: String, body: String, expiration: Number)` -- add a job to the topic, with contents `body` and which becomes available for processing at `expiration` time.

`release(topic: String, id: String)` -- delete a job that was previously `reserved`, indicating it has been run successfully

`delete(topic: String, id: String)` -- delete a job. Returns `1` if a job was removed `0` if no job was found.

`requeue(topic: String, max: Number, limit: Number)` -- put up to `limit` jobs with expiration less than `max` from the reserved queue into the jobs queue. Since these jobs have exceeded their TTR (time to run) without being `released`, it is assumed they failed.

## Networking
You have unlimited flexibility in how you connect a scheduler to other services. This respository contains simple  servers in [Node.js](https://github.com/bttmly/redisched/blob/master/node/server/index.js) and [Go](https://github.com/bttmly/redisched/blob/master/golang/main.go) that show how a scheduler might receive and dispatch jobs over HTTP.
