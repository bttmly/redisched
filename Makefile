build-go:
	node script/go_lua.js
	go build -race -o golang/bin/redisched golang/pkg/main.go
