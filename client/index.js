'use strict';
var godot = require('godot');
var sensortag = require('godot-sensortag');
var debug = require('debug')('sensortag:client');
var temperature = require('./temperature');
var memory = require('memory-producer');
var port = process.env.GODOT_PORT||1337;
var host = process.env.GODOT_SERVER||'localhost';
var producer = require('godot-producer');
var sensortagProducer = require('./sensortag');
var Dummy = producer(function() {
  this.ndx = 0;
}, function() {
  ++this.ndx;
  this.emit('data', {
    tags: ['st-metric'],
    metric: this.ndx,
    service: 'dummy/producer'
  });
});

var client = godot.createClient({
  type: 'tcp',
  reconnect: {
    retries: Infinity,
    maxDelay: 1000 * 10
  },
  producers: [
    /*Dummy({
      ttl: 600
    })*/
    sensortagProducer({
      ttl: +process.env.TTL || 1000 * 15,
    }),

    /*sensortag({
      ttl: +process.env.TTL || 1000 * 15,
      mappings: {
        'bc6a29ac9ad0': 'st2',
        '1cba8c20e2c8': 'st1'
      },
      tistOptions: {
        watch: false,
        sensors: ['irTemperature', 'humidity']
      }
    }),*/
    temperature({
      host: 'rpi',
      service: 'rpi/temperature'
    }),
    memory({
      host: 'rpi',
      service: 'rpi/memory'
    })
  ]
})
client
  .on('connect', function onconnect() {
    debug('connecting');
  })
  .on('error', function onerror(err) {
    debug('error occured: %s', err);
  })
  .on('reconnect', function onreconnect() {
    debug('trying to reconnect');
  });
client.connect(port, host, function(err) {
  if (err) {
    console.error(err);
  }
  console.log('Connected to %s:%s', host, port);
});
