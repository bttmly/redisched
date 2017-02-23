package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"path/filepath"
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

func NewScheduler(r *redis.Client) *Scheduler {
	return &Scheduler{
		redis:     r,
		sGet:      makeScript("./lua/get.lua"),
		sCancel:   makeScript("./lua/cancel.lua"),
		sSchedule: makeScript("./lua/schedule.lua"),
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
	log.Println("result:", result)

	if err != nil {
		return &Job{}, err
		// log.Fatal("error on get", err.Error())
	}

	body := result.(string)

	// in Schedule() we pad the body with 16 random characters to ensure uniqueness
	// so we need to slice them back off here
	body = body[:len(body)-16]

	return &Job{
		body,
	}, nil
}

func (s *Scheduler) Schedule(id string, body string, delay int) error {
	// TODO -- nanoseconds are too big to use as redis zset scores. Should use
	// milliseconds as the Node application does
	// score := time.Now().UnixNano() + int64(1e9*delay)

	score := time.Now().Unix() + int64(delay)
	salted := strings.Join([]string{body, uniuri.New()}, "")
	cmd := s.sSchedule.Eval(s.redis, []string{}, id, salted, score)

	fmt.Println("putting in score", score)

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
