package main

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"path/filepath"
	"time"

	redis "gopkg.in/redis.v5"
)

var put = makeScript("./lua/put.lua")
var del = makeScript("./lua/delete.lua")
var release = makeScript("./lua/release.lua")
var reserve = makeScript("./lua/reserve.lua")
var requeue = makeScript("./lua/requeue.lua")

type Scheduler struct {
	redis         *redis.Client
	subscriptions map[string]bool
}

type Job struct {
	body string
	id   string
}

func NewScheduler(r *redis.Client) *Scheduler {
	return &Scheduler{
		redis:         r,
		subscriptions: map[string]bool{},
	}
}

var RESERVE_SLEEP = time.Duration(250) * time.Millisecond

func (s *Scheduler) Subscribe(topic string) chan *Job {
	ch := make(chan *Job)
	s.subscriptions[topic] = true

	go func() {
		for {
			if s.IsSubscribed(topic) == false {
				close(ch)
				return
			}

			now := time.Now().Unix()
			cmd := reserve.Eval(s.redis, make([]string, 0), now)
			result, err := cmd.Result()

			if err != nil {
				log.Fatal("error on reserve from redis", err)
			}

			if result == nil {
				if s.IsSubscribed(topic) == false {
					close(ch)
					return
				}
				time.Sleep(RESERVE_SLEEP)
				continue
			}

			bytes := result.([]byte)
			job := &Job{}
			json.Unmarshal(bytes, job)
			ch <- job
		}
	}()

	return ch
}

func (s *Scheduler) IsSubscribed(topic string) bool {
	return s.subscriptions[topic] == true
}

func makeScript(relPath string) *redis.Script {
	path, err := filepath.Abs(relPath)
	if err != nil {
		log.Fatal("couldn't resolve path", err)
	}
	buf, err := ioutil.ReadFile(path)
	if err != nil {
		log.Fatal("couldn't read file", err)
	}

	return redis.NewScript(string(buf))
}
