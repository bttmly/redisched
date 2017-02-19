package main

import (
	"fmt"
	"log"

	redis "gopkg.in/redis.v5"
)

func main() {
	r := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "", // no password set
		DB:       0,  // use default DB
	})

	s := MakeScheduler(r)

	err := s.Schedule("id1", "golang", 0)
	fatal("error on schedule", err)

	job, err := s.Get()
	fatal("error getting job", err)

	fmt.Println("the job", job)
}

func fatal(s string, e error) {
	if e != nil {
		log.Fatal(s, e)
	}
}
