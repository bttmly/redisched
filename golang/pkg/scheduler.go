package redisched

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	redis "gopkg.in/redis.v5"
)

const (
	defaultReserveSleep = time.Duration(1) * time.Second
	defaultRequeueSleep = time.Duration(1) * time.Second
)

var put = redis.NewScript(RedisPutScript)
var del = redis.NewScript(RedisDeleteScript)
var release = redis.NewScript(RedisReleaseScript)
var reserve = redis.NewScript(RedisReserveScript)
var requeue = redis.NewScript(RedisRequeueScript)

type Scheduler struct {
	redis         *redis.Client
	subscriptions map[string]Topic
	requeueSleep  time.Duration
	reserveSleep  time.Duration
}

type ReadyJob struct {
	Topic    string `json:"topic"`
	ID       string `json:"id"`
	Contents string `json:"contents"`
}

type Cancellation struct {
	Topic string
	ID    string
}

type ScheduledJob struct {
	Topic    string
	ID       string
	Contents string
	Delay    time.Duration
}

type Topic struct {
	subscribed bool
	wg         *sync.WaitGroup
}

func NewScheduler(r *redis.Client) *Scheduler {
	return &Scheduler{
		redis:         r,
		subscriptions: map[string]Topic{},
		requeueSleep:  defaultRequeueSleep,
		reserveSleep:  defaultReserveSleep,
	}
}

func (s *Scheduler) Subscribe(topic string) (chan *ReadyJob, error) {
	if s.IsSubscribed(topic) {
		return nil, fmt.Errorf("Already subscribed to topic %s", topic)
	}

	s.subscriptions[topic] = Topic{
		subscribed: true,
		wg:         &sync.WaitGroup{},
	}

	ch := s.reserveLoop(topic)
	s.requeueLoop(topic)
	return ch, nil
}

func (s *Scheduler) reserveLoop(topic string) chan *ReadyJob {
	ch := make(chan *ReadyJob)
	s.add(topic)
	go func() {
		for {
			if !s.IsSubscribed(topic) {
				fmt.Println("exiting reserve loop")
				close(ch)
				break
			}

			now := time.Now().Unix()
			results, err := reserve.Eval(s.redis,
				[]string{},
				topic,
				now,
				60, // TTR -- TODO -- should be configurable
			).Result()

			if err != nil && err != redis.Nil {
				log.Fatal("error on reserve from redis ------", err, results)
			}

			if results == nil {
				// if there are no jobs ready, don't bog down the server with another request
				// immediately -- sleep for a bit then try and again
				time.Sleep(s.reserveSleep)
				continue
			}

			str := fmt.Sprintf("%v", results)
			parts := strings.Split(str[1:len(str)-1], " ")
			ch <- &ReadyJob{
				ID:       parts[0],
				Contents: parts[1],
				Topic:    topic,
			}
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
				fmt.Println("exiting requeue loop")
				break
			}

			now := time.Now().Unix()
			_, err := requeue.Eval(
				s.redis,
				[]string{},
				topic,
				now,
				// lua script provides a default limit for last argument
			).Result()

			if err != nil {
				log.Fatal("error on requeue from redis", err)
			}

			time.Sleep(s.requeueSleep)
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
	delete(s.subscriptions, topic)
}

func (s *Scheduler) IsSubscribed(topic string) bool {
	t, ok := s.subscriptions[topic]
	if !ok {
		return false
	}
	return t.subscribed
}

func (s *Scheduler) Put(j ScheduledJob) error {
	score := time.Now().Add(j.Delay).Unix()
	_, err := put.Eval(
		s.redis,
		[]string{},
		j.Topic,
		j.ID,
		j.Contents,
		score,
	).Result()
	return err
}

// { topic, id }
func (s *Scheduler) Remove(c Cancellation) error {
	_, err := del.Eval(
		s.redis,
		[]string{},
		c.Topic,
		c.ID,
	).Result()
	return err
}

// { topic, id }
func (s *Scheduler) Release(c Cancellation) error {
	score := time.Now().Unix()
	_, err := release.Eval(
		s.redis,
		[]string{},
		c.Topic,
		c.ID,
		score,
	).Result()
	return err
}

// add to the waitGroup for a given topic
func (s *Scheduler) add(topic string) {
	t, ok := s.subscriptions[topic]
	if !ok {
		return
	}
	t.wg.Add(1)
}

// done on the waitGroup for a given topic
func (s *Scheduler) done(topic string) {
	t, ok := s.subscriptions[topic]
	if ok == false {
		return
	}
	t.wg.Done()
}
