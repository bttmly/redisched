package main

import (
	"fmt"
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
	body string
}

func MakeScheduler(r *redis.Client) *Scheduler {
	return &Scheduler{
		redis:     r,
		sGet:      makeScript("../lua/get.lua"),
		sCancel:   makeScript("../lua/cancel.lua"),
		sSchedule: makeScript("../lua/schedule.lua"),
	}
}

func (s *Scheduler) Cancel(id string) error {
	cmd := s.sCancel.Eval(s.redis, make([]string, 0), id)
	result, err := cmd.Result()
	if err != nil {
		return err
		// log.Fatal("error on cancel", err.Error())
	}

	log.Println("result:", result)
	return nil
}

func (s *Scheduler) Get() (*Job, error) {
	now := time.Now().UnixNano()
	cmd := s.sGet.Eval(s.redis, make([]string, 0), now)

	result, err := cmd.Result()
	if err != nil {
		return &Job{}, err
		// log.Fatal("error on get", err.Error())
	}

	log.Println("result:", result)

	return &Job{
		body: result.(string),
	}, nil
}

func (s *Scheduler) Schedule(id string, body string, delay int) error {
	score := time.Now().UnixNano() + int64(1e9*delay)
	salted := strings.Join([]string{body, uniuri.New()}, "")
	cmd := s.sGet.Eval(s.redis, make([]string, 0), id, salted, score)

	result, err := cmd.Result()
	if err != nil {
		return err
	}

	fmt.Println("SCHEDULE result:", result)
	return nil
	//
	// if result == false {
	// 	return errors.New("Job content was not unique")
	// }
}

func makeScript(fileName string) *redis.Script {
	buf, err := ioutil.ReadFile("../lua/get.lua")
	if err != nil {
		log.Fatal("couldn't read file", err)
	}

	return redis.NewScript(string(buf))
}
