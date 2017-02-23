/* misc express crap */
const express = require('express');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const app = express();

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

/* the good stuff */
const fetch = require("node-fetch");
const Redis = require("ioredis");
const Scheduler = require("../scheduler");
const r = new Redis();
const s = new Scheduler(r);

s.subscribe("default", send).then(function () {
  console.log("SUBSCRIPTION ENDED!");
  r.close();
});

function send (message) {
  fetch(CONSUMER_URL, {
    method: "POST",
    body: JSON.stringify(message),
  }).then(() => {
    // TODO -- s.delete the message here!
  });
}

app.post("/schedule/:topic", function (req, res, next) {
  const { topic } = req.params;
  const { id, contents, delay } = req.body;
  if (topic !== "default") {
    return next(new Error("Only accepting messages on topic `default`"));
  }

  return s.schedule({ id, topic, contents, delay }).then(result => {
    console.log("cancel id %s topic %s:", id, topic result)
    res.status(200).json({ success: true });
  });
});

app.post("/cancel/:topic", function (req, res, next) {
  const { topic } = req.params;
  const { id } = req.body;
  if (topic !== "default") {
    return next(new Error("Only accepting messages on topic `default`"));
  }

  return s.delete({ id, topic }).then(result => {
    console.log("cancel id %s topic %s:", id, topic result)
    res.status(200).json({ success: true });
  });
});

/* more express crap */
app.use(function(req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: err,
  });
});

const debug = require('debug')('server');
app.set('port', process.env.PORT || 3000);

const server = app.listen(app.get('port'), function() {
  debug('Express server listening on port ' + server.address().port);
});
