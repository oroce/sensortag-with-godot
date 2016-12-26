'use strict';
var producer = require('godot-producer');
var Seq = require('seq-file');
var path = require('path');
var debug = require('debug')('client:flower-power-cloud');
var ago = require('time-ago')().ago;
var cloud = require('./cloud');
var get = cloud.get;
var auth = cloud.auth;
var Producer = producer(function ctor (options) {
  // this.seqNum = options.segNum || seqNum;
  debug('New instance, opts=%j', options);
  if (!options || !options.location) {
    throw new Error('options.location is mandatory');
  }

  this.options = options;

  this.seq = new Seq(path.join(__dirname, 'sequence-' + options.location + '.seq'));
  this.seqNum = this.seq.readSync();

  var tenDaysago = new Date();
  tenDaysago.setDate(tenDaysago.getDate() - 10);
  tenDaysago.setHours(tenDaysago.getHours() + 1);
  if (this.seq.seq == null || this.seq.seq < +tenDaysago) {
    debug('No sequence or old (%s - %s), saving %s - %s', ago(this.seq.seq || 0), this.seq.seq, ago(+tenDaysago), +tenDaysago);
    this.seq.save(tenDaysago.valueOf());
  } else {
    debug('applied seq is: %s - %s', ago(this.seq.seq), this.seq.seq);
  }
}, function produce () {
  var options = this.options;
  debug('starting produce, opts=%j', options);
  this.get(options);
});
module.exports = Producer;

Producer.prototype.get = function (options) {
  debug('getting %j', options);
  var location = options.location;
  var self = this;
  auth({
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    username: options.username,
    password: options.password
  }, function (err, token) {
    if (err) {
      return self.emit('error', err);
    }
    var until = new Date();
    var from = new Date(self.seq.seq);
    debug('getting from=%j, to=%j', from, until);
    get({
      token: token,
      from: from.toJSON(),
      until: until.toJSON(),
      location: location
    }, function (err, data) {
      if (err) {
        self.emit('error', err);
        return;
      }
      if (data.errors && data.errors.length) {
        self.emit('error', new Error(JSON.stringify(data)));
        return;
      }
      until = data.samples.reduce(function (prev, metric) {
        var time = new Date(metric.capture_ts);
        self.emit('data', {
          service: 'light/percent',
          metric: metric.par_umole_m2s,
          host: 'api.' + location + '.flower-power-cloud.com',
          tags: ['flower-power-cloud'],
          time: +time
        });
        self.emit('data', {
          service: 'temperature/air',
          metric: metric.air_temperature_celsius,
          host: 'api.' + location + '.flower-power-cloud.com',
          tags: ['flower-power-cloud'],
          time: +time
        });
        self.emit('data', {
          service: 'soil/moisture',
          metric: metric.vwc_percent,
          host: 'api.' + location + '.flower-power-cloud.com',
          tags: ['flower-power'],
          time: +time
        });
        return time;
      }, until);
      var fertilizers = data.fertilizer
        .filter(function (fertilizer) {
          var then = new Date(fertilizer.watering_cycle_end_date_time_utc);

          return then > from;
        });
      fertilizers
        .forEach(function (fertilizer) {
          self.emit('data', {
            service: 'fertilizer/level',
            metric: fertilizer.fertilizer_level,
            id: fertilizer.id,
            meta: fertilizer,
            time: +(new Date(fertilizer.watering_cycle_end_date_time_utc)),
            tags: ['flower-power-cloud'],
            host: 'api.' + location + '.flower-power-cloud.com'
          });
        });
      if (fertilizers.length === 0 && data.samples.length === 0) {
        debug('No need to save the new until (%s) because there was no samples nor fertilizers.', until);
        return;
      }
      debug('saving new until: %s - %s', ago(+until), until);
      self.seq.save(until.valueOf());
    });
  });
};
