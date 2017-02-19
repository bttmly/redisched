package main

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

func main() {
	r := redis.NewClient(&redis.Options{
    Addr:     "localhost:6379",
    Password: "", // no password set
    DB:       0,  // use default DB
	})

	s := NewScheduler(r)

	err := s.Schedule("id1", "golang", 0)
	fatal("error on schedule", err)

	err, job := s.Get()
	fatal("error getting job", err)
}

func fatal (s string, e error) {
	if (e != nil) {
		log.Fatal(s, e)
	}
}
