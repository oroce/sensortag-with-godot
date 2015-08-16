'use strict';
var producer = require('godot-producer');
var debug = require('debug')('client:weather');
var Wunderground = require('wundergroundnode');

module.exports = producer(function ctor(options) {
  debug('New instance, opts=%j', options);
  options || (options = {});
  if (!options.key) {
    throw new Error('Missing weather.com key');
  }
  if (!options.location) {
    throw new Error('Missing weather.com location, query');
  }
  this.wunderground = new Wunderground(options.key);
  this.options = options;
  this.on('error', console.error.bind(console));
}, function produce() {
  var self = this;
  var options = this.options;
  debug('starting produce, opts=%j', options);
  this.wunderground.conditions().request(options.location, function(err, condition) {
    if (err) {
      self.emit('error', err);
      return;
    }
    var obs = condition.current_observation;
    var time = new Date(obs.observation_time_rfc822);
    self.emit('data', {
      service: 'weather/temperature',
      time: +time,
      metric: obs.temp_c,
      tags: ['weather'],
      host: 'api.weather.com'
    });
    self.emit('data', {
      service: 'weather/humidity',
      time: +time,
      metric: parseInt(obs.relative_humidity, 10),
      tags: ['weather'],
      host: 'api.weather.com'
    });
    self.emit('data', {
      service: 'weather/feelslike',
      time: +time,
      metric: obs.feelslike_c,
      tags: ['weather'],
      host: 'api.weather.com'
    });
    self.emit('data', {
      service: 'weather/wind',
      time: +time,
      metric: obs.wind_kph,
      tags: ['weather'],
      host: 'api.weather.com'
    });
  });
});
