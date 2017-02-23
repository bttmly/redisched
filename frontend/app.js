const port = process.env.PORT || 3000;
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

    // console.log("frontend application sending", data.id);

    data.created_at = Date.now();
    data.status = "pending";
    data.topic = "scheduler_demo";

    sendHttp(data).then(function () {
      io.emit("message_scheduled", data);
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

server.listen(port, function () {
  console.log("************ started ************");
});

app.use(function (req, res, next) {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

if (app.get("env") === "development") {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.json({
      message: err.message,
      error: err,
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: {},
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
    url: `http://localhost:${WEBHOOK_PORT}/`,
    method: "POST",
    json: true,
    body: data,
  });
}

module.exports = { app, server, io };
