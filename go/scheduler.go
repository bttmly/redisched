package main

import (
	"io/ioutil"
	"log"
	"strings"
	"time"

	"github.com/dchest/uniuri"

	redis "gopkg.in/redis.v5"
)

type Scheduler struct {
	redis     *redis.Client
	sGet      *redis.Script
	sCancel   *redis.Script
	sSchedule *redis.Script
}

func NewScheduler() *Scheduler {
	s := &Scheduler{
		redis:     redis.NewClient(),
		sGet:      makeScript("../lua/get.lua"),
		sCancel:   makeScript("../lua/cancel.lua"),
		sSchedule: makeScript("../lua/schedule.lua"),
	}

	return s
}

func (s *Scheduler) Cancel(id string) {
	cmd := s.sCancel.Eval(s.redis, make([]string), id)
	err, result := cmd.Result()
	if err {
		log.Fatal("error on cancel", err.Error())
	}

	log.Println("result:", result)
	return
}

func (s *Scheduler) Get() {
	now := time.Now().UnixNano()
	cmd := s.sGet.Eval(s.redis, make([]string), now)

	err, result := cmd.Result()
	if err {
		log.Fatal("error on get", err.Error())
	}

	log.Println("result:", result)
	return
}

func (s *Scheduler) Schedule(id string, body string, delay int) {
	score = time.Now().UnixNano() + 1e9*delay
	salted := strings.Join(body, uniuri.New())
	cmd := s.sGet.Eval(s.redis, make([]string), id, salted, score)

	err, result := cmd.Result()
	if err {
		log.Fatal("error on get", err.Error())
	}

	log.Println("result:", result)
	return
}

func makeScript(fileName string) *redis.Script {
	buf, err := ioutil.ReadFile("../lua/get.lua")
	if err {
		log.Fatal("couldn't read file", err)
	}

	return redis.NewScript(string(buf))
}
