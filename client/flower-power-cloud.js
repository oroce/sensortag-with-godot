'use strict';
var producer = require('godot-producer');
var request = require('request');
var Seq = require('seq-file');
var path = require('path');
var seq = new Seq(path.join(__dirname, 'sequence.seq'));
var seqNum = seq.readSync();
var debug = require('debug')('client:flower-power-cloud');
module.exports = producer(function ctor(options) {
  //this.seqNum = options.segNum || seqNum;
  this.options = options;
  var tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  tenDaysAgo.setHours(tenDaysAgo.getHours() + 1);
  if (seq.seq == null || seq.seq < +tenDaysAgo) {
    debug('No sequence or old (%s), saving %s', seq.seq, +tenDaysAgo);
    seq.save(+tenDaysAgo);
  }
}, function produce() {
  var self = this;
  var options = this.options;
  debug('starting produce');
  auth({
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    username: options.username,
    password: options.password
  },function(err, token) {
    if (err) {
      return self.emit('error', err);
    }
    var until = new Date();
    var from = new Date(seq.seq);
    debug('getting from=%j, to=%j', from, until);
    get({
      token: token,
      from: from.toJSON(),
      until: until.toJSON(),
      location: options.location
    }, function(err, data) {
      if (err) {
        self.emit('error', err);
        return;
      }
      //console.log(data);
      data.samples.forEach(function(metric) {
        var time = new Date(metric.capture_ts);
        self.emit('data', {
          service: 'light',
          metric: metric.par_umole_m2s,
          host: 'flower-power-cloud',
          tags: ['flower-power'],
          time: +time
        });
        self.emit('data', {
          service: 'temperature/air',
          metric: metric.air_temperature_celsius,
          host: 'flower-power-cloud',
          tags: ['flower-power'],
          time: +time
        });
        self.emit('data', {
          service: 'soil/moisture',
          metric: metric.vwc_percent,
          host: 'flower-power-cloud',
          tags: ['flower-power'],
          time: +time
        });
      });
      debug('saving new until: %s', until);
      seq.save(+until);
    });
  });
});


function auth(options, cb) {
  request({
    url: 'https://apiflowerpower.parrot.com/user/v1/authenticate',
    qs: {
      grant_type: 'password',
      client_id: options.clientId,
      client_secret: options.clientSecret,
      username: options.username,
      password: options.password
    },
    json: true
  }, function(err, response, json) {
    if (err) {
      return cb(err);
    }
    cb(null, json.access_token);
  });
}

module.exports.auth = auth;

function get(options, cb) {
  request({
    url: 'https://apiflowerpower.parrot.com/sensor_data/v2/sample/location/' + options.location,
    headers: {
      'Authorization': 'Bearer ' + options.token
    },
    qs: {
      from_datetime_utc: options.from,
      to_datetime_utc: options.to,
    },
    json: true
  }, function(err, resp, json) {
    if (err) {
      return cb(err);
    }

    cb(null, json);
  });
}
module.exports.get = get;
