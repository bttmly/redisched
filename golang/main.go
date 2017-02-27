package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	redis "gopkg.in/redis.v5"
)

func main() {
	r := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "", // no password set
		DB:       0,  // use default DB
	})

	s := NewScheduler(r)

	send := func(j *ReadyJob) {
		data, err := json.Marshal(j)
		fatal("json marshal failed", err)

		resp, err := http.Post("http://localhost:9191/receive", "application/json", bytes.NewBuffer(data))
		fatal("http post error", err)

		fmt.Println("sent", j, "status", resp.StatusCode)
		s.Remove(Cancellation{j.Topic, j.ID})
	}

	go func() {
		ch, err := s.Subscribe("default")
		fatal("error on subscribe", err)
		for j := range ch {
			send(j)
		}
	}()

	putHandler := func(w http.ResponseWriter, r *http.Request) {
		j := ScheduledJob{}
		err := json.NewDecoder(r.Body).Decode(&j)
		fatal("schedule: json decode failed", err)
		j.Topic = r.URL.Path[len("/schedule/"):]
		j.Delay *= time.Second
		fmt.Println("scheduled job", j)
		err = s.Put(j)
		fatal("error on put", err)
	}

	cancelHandler := func(w http.ResponseWriter, r *http.Request) {
		j := Cancellation{}
		err := json.NewDecoder(r.Body).Decode(&j)
		fatal("cancel: json decode failed", err)
		j.Topic = r.URL.Path[len("/schedule/"):]
		fmt.Println("cancel job", j)
	}

	http.HandleFunc("/schedule/", putHandler)
	http.HandleFunc("/cancel/", cancelHandler)
	http.ListenAndServe(":7171", nil)
}

func fatal(s string, e error) {
	if e != nil {
		log.Fatal(s, e)
	}
}
