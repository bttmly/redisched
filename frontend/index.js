const express = require("express");
const path = require("path");
const logger = require("morgan");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const debug = require("debug")("scheduler-client");
const request = require("request-promise");

const app = express();

app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const server = require("http").Server(app);
const io = require("socket.io")(server);

// receiving data from client
io.on("connection", socket => {
  socket.on("send_message", data => {

    const message = {
      id: data.id,
      contents: data.body,
      delay: data.delay,
      created_at: Date.now(),
      status: "pending",
      topic: "default",
    };

    sendHttp(message).then(function () {
      io.emit("message_scheduled", message);
    })
    .catch(err => debug("error from message_scheduled request", err.message));
  });

  socket.on("cancel_message", data => {
    data.type = "cancellation";
    sendHttp(data).then(function () {
      io.emit("message_cancelled", data);
    })
    .catch(err => debug("error from cancel_message request", err.message));
  });
});

// receive completed messages from scheduler via HTTP
app.post("/receive", function (req, res) {
  receiveMessage(req.body);
  res.status(200).json({ ok: true });
});

app.use(function (req, res, next) {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

app.use(function (err, req, res, next) {
  if (err.status !== 404) {
    console.log("server error", err);
  }

  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: err,
  });
});

function receiveMessage (message) {
  if (Buffer.isBuffer(message)) message = message.toString();
  if (typeof message === "string") message = JSON.parse(message);
  io.emit("message_completed", { id: message.id });
}

function sendHttp (data) {
  const WEBHOOK_PORT = 7171;
  return request({
    url: `http://localhost:${WEBHOOK_PORT}/schedule/${data.topic}`,
    method: "POST",
    json: true,
    body: data,
  });
}

const FRONTEND_PORT = 9191;
server.listen(FRONTEND_PORT, function () {
  console.log("frontend started on 9191");
});

// module.exports = { app, server, io };
