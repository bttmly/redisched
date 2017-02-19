package main

import (
	"errors"
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

type Job struct {
	body []byte
}

func NewScheduler(r *redis.Client) *Scheduler {
	return &Scheduler{
		redis:     r,
		sGet:      makeScript("../lua/get.lua"),
		sCancel:   makeScript("../lua/cancel.lua"),
		sSchedule: makeScript("../lua/schedule.lua"),
	}
}

func (s *Scheduler) Cancel(id string) error {
	cmd := s.sCancel.Eval(s.redis, make([]string), id)
	err, result := cmd.Result()
	if err {
		return err
		// log.Fatal("error on cancel", err.Error())
	}

	log.Println("result:", result)
}

func (s *Scheduler) Get() (error, Job) {
	now := time.Now().UnixNano()
	cmd := s.sGet.Eval(s.redis, make([]string), now)

	err, result := cmd.Result()
	if err {
		return err, nil
		// log.Fatal("error on get", err.Error())
	}

	log.Println("result:", result)

	return &Job{
		body: result,
	}
}

func (s *Scheduler) Schedule(id string, body string, delay int) error {
	score = time.Now().UnixNano() + 1e9*delay
	salted := strings.Join(body, uniuri.New())
	cmd := s.sGet.Eval(s.redis, make([]string), id, salted, score)

	err, result := cmd.Result()
	if err {
		return err
	}

	if result == false {
		return errors.New("Job content was not unique")
	}
}

func makeScript(fileName string) *redis.Script {
	buf, err := ioutil.ReadFile("../lua/get.lua")
	if err {
		log.Fatal("couldn't read file", err)
	}

	return redis.NewScript(string(buf))
}
