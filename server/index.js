var godot = require('godot');
var influx = require('godot-influxdb');
var expired = false;
var request = require('request');
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

      socket
        .pipe(tagged)

        .pipe(godot.expire(1000 * 10))
        .pipe(godot.console(function(data) {
          opsgenie('down', 'expiry');
          expired = true;
        }));

      socket
        .pipe(tagged)
        .pipe(godot.console(function() {
          if (expired) {
            opsgenie('up')
            expired = false;
            return;
          }
        }));

      return socket;
    }
  ]
}).listen(1337);

function opsgenie(state, reason) {
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
  console.log('send to %s with=', url, data);
  request({
    url: url,
    method: 'POST',
    json: data
  }, function(err, response, body){
    if (err) {
      return console.error(err);
    }

    // this is a special case when somebody solved the problem (it isnt open anymore)
    // or we missed the critical state and should silently skip the error
    if (body.code === 5){
      return console.log('Issue was already ackd');
    }

    if (body.error) {
      return console.error(new Error(body.error));
    }

    console.log(body);
  });
}