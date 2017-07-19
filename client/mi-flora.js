'use strict';
var producer = require('godot-producer');
var MiFlora = require('node-mi-flora');
var deepextend = require('deep-extend');
var debug = require('debug')('swg:device:mi-flora');
var first = require('ee-first');
var lock = require('./lock');

var Producer = producer(function MiFloraProducer (options) {
  var uuid = this.uuid = options.uuid;
  this.options = options;
  debug('initialized mi flora with %s', this.uuid || '<empty uuid>');
  this.on('error', console.error.bind(console));
  this.flora = new MiFlora(uuid);
  this.flora.on('data', this.onDiscover.bind(this));
}, function produce () {
  var hasDevice = this.device != null;
  var hasLock = this.release != null;
  var options = this.options;
  clearTimeout(this.timeout);
  debug('producing, stopping and restarting discovery (device=%s,lock=%s)', hasDevice, hasLock);
  debug('im %s but originally MiFlora', this.ctorName);
  if (this.device) {
    debug('disconnecting device');
    this.device.disconnect();
    this.device = null;
  }
  if (this.cancelLock) {
    debug('cancelling lock');
    this.cancelLock();
  }
  if (this.release) {
    debug('releasing lock');
    this.release();
    this.release = null;
  }
  if (this.thunk) {
    debug('cancelling thunk');
    this.thunk.cancel();
    this.thunk = null;
  }
  var closing = false;
  var ttl = options.ttl / 2;
  debug('Waiting %sms till close', ttl);
  this.timeout = setTimeout(function () {
    debug('Producer is about to close');
    closing = true;
    if (this.cancelLock) {
      this.cancelLock();
    } else {
      debug('already canceled/ended');
    }
  }.bind(this), ttl);
  this.cancelLock = lock('mi-flora', function (er, rls) {
    if (er) {
      if (this.thunk) {
        this.thunk.cancel();
      }
      this.emit('error', er);
      return;
    }
    if (closing) {
      debug('producer is closing');
      rls();
      return;
    }
    clearTimeout(this.timeout);
    debug('lock received');
    this.release = rls;
    this.thunk = first([[this, 'data', 'error']], function (err, ee, evt) {
      if (err) {
        this.emit('error', err);
      }
      debug('received %s, remove think, release', evt);
      rls();
      this.thunk = null;
      this.release = null;
    }.bind(this));

    this.flora.startScanning();
  }.bind(this));
});

module.exports = Producer;

Producer.prototype.onDiscover = function onDiscover (data) {
  this.flora.stopScanning();
  debug('received data: ', data);
  emit('temperature/air', data.temperature);
  emit('soil/moisture', data.moisture);
  emit('sunlight/value', data.lux);
  function emit (service, metric, obj) {
    service = 'miflora/' + service;
    this.emit('data', deepextend({
      service: service,
      metric: metric,
      host: data.deviceId,
      tags: ['device:mi-flora', 'sensor']
    }, obj));
  }
};
