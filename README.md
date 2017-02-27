# redisched

## What is this?
A programming language-agnostic job queue implementation backed by Redis. The bulk of the logic of this system lives in Lua scripts that can be used by any Redis client that supports scripting. In addition, for a given programming language or platform, a bit of glue code must be written to wire the whole thing together. Further, it will be up to you to attach some kind of networking interface to the system so it can receive and dispatch jobs.

## Why would I use it?
The biggest motivating factor, and functional difference from work queues like Beanstalkd or Disque is that `redisched` jobs have a client-provided identifier, and can be accessed or deleted by that identifier. This would be particularly useful if an application has some kind of well-known identifying scheme. For example, upon user sign up an email job is scheduled for three days later, with the identifier `need_some_help_email_<user_id>`. Now if the user completes some significant action before the three days are up, we can just delete the job with the id `need_some_help_email_<user_id>`.

## How do I use it?
This repository contains two implementations, one for [Node.js]() and the other in [Go](). These can be used as is and hooked up to whatever networking system you choose -- for instance, it is trivial to have the Scheduler receive jobs from a RabbitMQ instance and dispatch them when ready to a web hook. For other platforms, you will need to implement the Scheduler by hand, which should be straightforward.

## Implementing a scheduler
There are five key scheduling operations, three of which are "active" (i.e. a client initiates them) and two of which are "passive" (i.e. they happen in the background, on a loop). The active operations are `PUT` (add a job), `DELETE` (remove a job), and `RELEASE` (requeue a single job). The background operation is `REQUEUE` (requeues all reserved jobs which have timed out). `RESERVE` is the operation to get a job, and can be called either passively or actively. This largely depends on how the scheduler is used -- for instance if it is acting as a "push" service (POST-ing data to a web hook for example) then the scheduler would probably run `RESERVE` in a loop and fire off an HTTP request whenever a job becomes available. On the other hand, if it is acting as a "pull" service (receiving inbound requests for ready jobs) then `RESERVE` would just be called when a client asked for a job. As a rough measure, the Node.js and Go implementations of this system are around 100-200 lines of code.

## Networking
You have unlimited flexibility in how you connect a scheduler to other services. This respository contains simple HTTP servers in [Node.js]() and [Go]() that show 
