var godot = require('godot');
var influx = require('godot-influxdb');
var expired = false;
var request = require('request');
var debug = require('debug')('sensortag:server');
var port = +process.env.PORT || 1337;
debug('server will listen on %s', port);
var server = godot.createServer({
  type: 'udp',
  reactors: [
    function (socket) {
      return socket
        .pipe(godot.console(function(d){
          console.log(JSON.stringify(d));
        }))
        .pipe(influx({
          host: 'localhost',
          port: 8086,
          user: process.env.INFLUXDB_USER || '',
          password: process.env.INFLUXDB_PASSWORD || '',
          database: process.env.INFLUXDB_DB || 'test'
        }));
    },
    function(socket) {
      var tagged = new (godot.tagged)('any', 'st-metric');
      var expiry = +process.env.EXPIRY || 1000 * 10;
      var throttle = +process.env.THROTTLE || 1000 * 60;
      debug('expiry=%s, throttle=%s', expiry, throttle);
      socket
        .pipe(tagged)
        .pipe(godot.expire(expiry))
        .pipe(godot.console(function(data) {
          opsgenie('down', 'expiry');
        }));

      socket
        .pipe(tagged)
        .pipe(godot.throttle(1, throttle))
        .pipe(godot.console(function() {
          opsgenie('up');
        }));

      return socket;
    }
  ]
}).listen(port);

function opsgenie(state, reason) {
  debug('opsgenie states into=%s at %s', state, (new Date()).toJSON());
  var url;
  var data = {
    apiKey: process.env.CUSTOMER_KEY,
    alias: 'sensortag'
  };
  if (state === 'up') {
    url = 'https://api.opsgenie.com/v1/json/alert/close';
  } else {
    url = 'https://api.opsgenie.com/v1/json/alert';
    data.message = 'sensortag monitoring went down because of ' + (reason || 'reasons');
  }
  debug('send to %s with=', url, data);
  request({
    url: url,
    method: 'POST',
    json: data
  }, function(err, response, body){
    if (err) {
      // logstash? incident about incident handler failed to handle incident, incidentception...:(((
      return console.error(err);
    }

    // this is a special case when somebody solved the problem (it isnt open anymore)
    // or we missed the critical state and should silently skip the error
    if (body.code === 5){
      // logstash?
      return console.log('Issue was already ackd');
    }

    if (body.error) {
      // logstash?
      return console.error(new Error(body.error));
    }

    console.log(body);
  });
}