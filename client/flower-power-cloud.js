'use strict';
var producer = require('godot-producer');
var request = require('request');
var Seq = require('seq-file');
var path = require('path');
var seq = new Seq(path.join(__dirname, 'sequence.seq'));
var seqNum = seq.readSync();
var debug = require('debug')('client:flower-power-cloud');
var ago = require('time-ago')().ago;
var cloud = require('./cloud');
var get = cloud.get;
var auth = cloud.auth;
var garden = cloud.garden;
module.exports = producer(function ctor(options) {
  //this.seqNum = options.segNum || seqNum;
  debug('New instance, opts=%j', options);
  this.options = options;
  var tenDaysago = new Date();
  tenDaysago.setDate(tenDaysago.getDate() - 10);
  tenDaysago.setHours(tenDaysago.getHours() + 1);
  if (seq.seq == null || seq.seq < +tenDaysago) {
    debug('No sequence or old (%s - %s), saving %s - %s', ago(seq.seq || 0), seq.seq, ago(+tenDaysago), +tenDaysago);
    seq.save(tenDaysago.valueOf());
  } else {
    debug('applied seq is: %s - %s', ago(seq.seq), seq.seq);
  }
}, function produce() {
  var self = this;
  var options = this.options;
  debug('starting produce, opts=%j', options);
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

      data.samples.forEach(function(metric) {
        var time = new Date(metric.capture_ts);
        self.emit('data', {
          service: 'light/percent',
          metric: metric.par_umole_m2s,
          host: 'api.flower-power-cloud.com',
          tags: ['flower-power-cloud'],
          time: +time
        });
        self.emit('data', {
          service: 'temperature/air',
          metric: metric.air_temperature_celsius,
          host: 'api.flower-power-cloud.com',
          tags: ['flower-power-cloud'],
          time: +time
        });
        self.emit('data', {
          service: 'soil/moisture',
          metric: metric.vwc_percent,
          host: 'api.flower-power-cloud.com',
          tags: ['flower-power'],
          time: +time
        });
      });
      var fertilizers = data.fertilizer
        .filter(function(fertilizer) {
          var then = new Date(fertilizer.watering_cycle_end_date_time_utc);

          return then > from;
        });
      fertilizers
        .forEach(function(fertilizer) {
          self.emit('data', {
            service: 'fertilizer/level',
            metric: fertilizer.fertilizer_level,
            id: fertilizer.id,
            meta: fertilizer,
            time: +(new Date(fertilizer.watering_cycle_end_date_time_utc)),
            tags: ['flower-power-cloud'],
            host: 'api.flower-power-cloud.com'
          });
        });
      if (fertilizers.length === 0 && data.samples.length === 0) {
        debug('No need to save the new until (%s) because there was no samples nor fertilizers.', until);
        return;
      }
      debug('saving new until: %s - %s', ago(+until), until);
      seq.save(until.valueOf());
    });
  });
});
