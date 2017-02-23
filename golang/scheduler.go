package main

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"path/filepath"
	"sync"
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
	subscriptions map[string]Topic
}

type Job struct {
	body string
	id   string
}

type Topic struct {
	subscribed bool
	wg         *sync.WaitGroup
}

func NewScheduler(r *redis.Client) *Scheduler {
	return &Scheduler{
		redis:         r,
		subscriptions: map[string]Topic{},
	}
}

var RESERVE_SLEEP = time.Duration(250) * time.Millisecond
var REQUEUE_SLEEP = time.Duration(1) * time.Second

func (s *Scheduler) Subscribe(topic string) chan *Job {
	ch := s.reserveLoop(topic)
	s.requeueLoop(topic)
	return ch
}

func (s *Scheduler) reserveLoop(topic string) chan *Job {
	ch := make(chan *Job)
	s.add(topic)
	go func() {
		for {
			if !s.IsSubscribed(topic) {
				close(ch)
				break
			}

			now := time.Now().Unix()
			result, err := reserve.Eval(s.redis, make([]string, 0), now).Result() // TODO fix arguments here

			if err != nil {
				log.Fatal("error on reserve from redis", err)
			}

			if result == nil {
				// if there are no jobs ready, don't bog down the server with another request
				// immediately -- sleep for a bit second then try and again
				time.Sleep(RESERVE_SLEEP)
				continue
			}

			job := &Job{}
			json.Unmarshal(result.([]byte), job)
			ch <- job
		}
		s.done(topic)
	}()

	return ch
}

func (s *Scheduler) requeueLoop(topic string) {
	s.add(topic)
	go func() {
		for {
			if !s.IsSubscribed(topic) {
				break
			}

			now := time.Now().Unix()
			_, err := requeue.Eval(s.redis, make([]string, 0), now).Result() // TODO fix arguments here
			if err != nil {
				log.Fatal("error on requeue from redis", err)
			}

			time.Sleep(REQUEUE_SLEEP)
		}
		s.done(topic)
	}()
}

// Unsubscribe blocks until the topic is completely done requesting jobs
func (s *Scheduler) Unsubscribe(topic string) {
	t, ok := s.subscriptions[topic]
	if !ok {
		return
	}
	t.subscribed = false
	t.wg.Wait()
}

func (s *Scheduler) IsSubscribed(topic string) bool {
	t, ok := s.subscriptions[topic]
	if !ok {
		return false
	}
	return t.subscribed
}

func (s *Scheduler) add(topic string) {
	t, ok := s.subscriptions[topic]
	if !ok {
		return
	}
	t.wg.Add(1)
}

func (s *Scheduler) done(topic string) {
	t, ok := s.subscriptions[topic]
	if ok == false {
		return
	}
	t.wg.Done()
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
