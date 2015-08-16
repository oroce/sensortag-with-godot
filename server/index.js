var godot = require('godot');
var influx = require('godot-influxdb');
var request = require('request');
var debug = require('debug')('sensortag:server');
var port = +process.env.PORT || 1337;
var format = require('util').format;
debug('server will listen on %s', port);
var async = require('async');
var tagged = new (godot.tagged)('any', 'st-metric');
var expiry = +process.env.EXPIRY || 1000 * 10;
var throttle = +process.env.THROTTLE || 1000 * 60;
debug('expiry=%s, throttle=%s', expiry, throttle);
var influxReactor = influx({
  host: 'localhost',
  port: 8086,
  user: process.env.INFLUXDB_USER || '',
  password: process.env.INFLUXDB_PASSWORD || '',
  database: process.env.INFLUXDB_DB || 'test'
});
var writeQueue = async.queue(function(data, cb) {
  var point = influxReactor.format(data);
  influxReactor.client.writePoint(point.name, point.metric, function(err) {
    if (err) {
      influxReactor.emit('reactor:error', err);
    }
    cb(err);
  });
}, 2);
influxReactor.write = function write(data) {
  writeQueue.push(data);
  this.emit('data', data);
};

var server = godot.createServer({
  type: 'tcp',
  reactors: [
    function (socket) {
      return socket
        .pipe(godot.console(function(d){
          console.log(JSON.stringify(d, null, 2));
        }))
        .pipe(influxReactor);
    },
    function down(socket) {
      return socket
        .pipe(tagged)
        .pipe(
          godot.by('host', function(socketByHost) {
            return socketByHost
              .pipe(godot.expire(expiry))
              .pipe(godot.console(function(data) {
                  opsgenie('down', 'expiry', data || {});
              }))
          })
        );
    },
    function up(socket) {
      return socket
        .pipe(tagged)
        .pipe(
          godot.by('host', function(socketByHost) {
            return socketByHost
              .pipe(godot.throttle(1, throttle))
              .pipe(godot.console(function(data) {
                opsgenie('up', null, data || {});
              }));
          })
        );
    },
  ]
}).listen(port);

function opsgenie(state, reason, options) {
  debug('opsgenie states into=%s at %s (%j)', state, (new Date()).toJSON(), options);
  var url;
  var data = {
    apiKey: process.env.CUSTOMER_KEY,
    alias: 'sensortag'
  };
  if (state === 'up') {
    url = 'https://api.opsgenie.com/v1/json/alert/close';
  } else {
    url = 'https://api.opsgenie.com/v1/json/alert';
    data.message = format('sensortag of %s monitoring went down because of %s', options.host, (reason || 'reasons'));
  }
  return debug('state=%s, message=%s', state, data.message);
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
