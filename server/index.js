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
var email = require('./email');
var config = require('./config');
var humanizeDuration = require('humanize-duration');
debug('expiry=%s, throttle=%s', expiry, throttle);
var influxReactor = influx({
  host: config.influxdb.host,
  port: config.influxdb.port,
  user: config.influxdb.user,
  password: config.influxdb.password,
  database: config.influxdb.database
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
var forward = require('./forward');
var reactors = [];
if (config.uptime.enabled) {
  var reboot;
  if (config.email.enabled) {
    reboot = email({
      auth: config.email.auth,
      from: config.email.from,
      to: config.email.to,
      interval: 1,
      host: config.email.host,
      port: config.email.port,
      subject: function(data) {
        return data.hostname + ' rebooted at ' + new Date(data.metric);
      },
      body: function(data, prevMetric) {
        var duration = new Date(data.metric) - prevMetric;
        var text = [
          'Rebooted at: ' + new Date(data.metric) + '(' + data.metric + ')',
          'Last metric: ' + new Date(prevMetric) + '(' + prevMetric + ')',
          'Duration: ' + humanizeDuration(duration) + '(' + duration + ')'
        ];
        return [
          text.join('\n'),
          data.description,
          JSON.stringify(data, null, 2)
        ].join('\n\n');
      }
    });
  } else {
    reboot = godot.console(function(data) {
      debug(data.description);
    });
  }
  var change = godot.change('metric');
  reboot.lastMetric = change.last = 0;

  reactors.push(function (socket) {
    return socket
      .pipe(godot.where('service', '*/uptime'))
      .pipe(change)
      .pipe(reboot);
  });
}
if (config.influxdb.enabled) {
  reactors.push(function (socket) {
    return socket
      .pipe(godot.console(function(d){
        console.log(JSON.stringify(d, null, 2));
      }))
      .pipe(influxReactor);
  });
}
if (config.expire.enabled) {
  reactors.push(function down(socket) {
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
  });
}
if (config.throttle.enabled) {
  reactors.push(function up(socket) {
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
  });
}
if (config.forward.enabled) {
  var forwardReactor = forward({
    type: config.forward.type,
    host: config.forward.host,
    port: config.forward.port
  });
  reactors.push(function forwarder(socket) {
    return socket
      .pipe(forwardReactor);
  });
}
var server = godot.createServer({
  type: 'tcp',
  reactors: reactors
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
