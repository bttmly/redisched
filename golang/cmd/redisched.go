package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"time"

	scheduler "github.com/nickb1080/redisched/golang/pkg"

	redis "gopkg.in/redis.v5"
)

func main() {
	r := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "", // no password set
		DB:       0,  // use default DB
	})

	s := scheduler.NewScheduler(r)

	send := func(j *scheduler.ReadyJob) {
		data, err := json.Marshal(j)
		fatal("json marshal failed", err)

		resp, err := http.Post("http://localhost:9191/receive", "application/json", bytes.NewBuffer(data))
		fatal("http post error", err)

		if resp.StatusCode != 200 {
			log.Fatal("error posting to webhook", resp.Status)
		}

		fatal("error on remove", s.Remove(scheduler.Cancellation{Topic: j.Topic, ID: j.ID}))
	}

	go func() {
		ch, err := s.Subscribe("default")
		fatal("error on subscribe", err)
		for j := range ch {
			send(j)
		}
	}()

	http.HandleFunc("/schedule/", func(w http.ResponseWriter, r *http.Request) {
		j := scheduler.ScheduledJob{}
		err := json.NewDecoder(r.Body).Decode(&j)
		fatal("schedule: json decode failed", err)
		j.Topic = r.URL.Path[len("/schedule/"):]
		j.Delay *= time.Second
		// fmt.Println("scheduled job", j)
		fatal("error on put", s.Put(j))
	})

	http.HandleFunc("/cancel/", func(w http.ResponseWriter, r *http.Request) {
		c := scheduler.Cancellation{}
		err := json.NewDecoder(r.Body).Decode(&c)
		fatal("cancel: json decode failed", err)
		c.Topic = r.URL.Path[len("/cancel/"):]
		fatal("error on cancel", s.Remove(c))
	})

	http.ListenAndServe(":7171", nil)
}

func fatal(s string, e error) {
	if e != nil {
		log.Fatal(s, e)
	}
}
