'use strict';
var producer = require('godot-producer');
var FlowerPower = require('flower-power');
var series = require('run-series');
var deepextend = require('deep-extend');
var debug = require('debug')('swg:device:flower-power');
var first = require('ee-first');
var lock = require('./lock');
var discover = require('./discover');
discover(FlowerPower);
var stopDiscoverThis = function(that, cb) {
  return discover.stopDiscoverThis(that, cb, debug);
};
var discoverThis = function(that, cb) {
  return discover.discoverThis(that, cb, debug);
};
var Producer = producer(function FlowerPowerProducer(options) {
  var uuid = this.uuid = options.uuid;
  this.options = options;
  var self = this;
  debug('initialized flower power with %s', this.uuid || '<empty uuid>');
  this.filter = function fpFilter(device) {
    if (!uuid) {
      debug('filtering %s, but no filter', device.uuid);
      self.onDiscover(device);
      return;
    }
    debug('filtering device: "%s" <=> "%s"', device.uuid, uuid);
    if (device.uuid === uuid) {
      self.onDiscover(device);
    }
  };
  this.on('error', console.error.bind(console));
}, function produce() {
  var hasDevice = this.device != null;
  var hasLock = this.release != null;
  var options = this.options;
  clearTimeout(this.timeout);
  debug('producing, stopping and restarting discovery (device=%s,lock=%s)', hasDevice, hasLock);
  debug('im %s but originally FlowerPower', this.ctorName);
  stopDiscoverThis(FlowerPower, this.filter);
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
    stopDiscoverThis(FlowerPower, this.filter);
  }
  if (this.thunk) {
    debug('cancelling thunk');
    this.thunk.cancel();
    this.thunk = null;
    stopDiscoverThis(FlowerPower, this.filter);
  }
  var closing = false;
  var ttl = options.ttl / 2;
  debug('Waiting %sms till close', ttl);
  this.timeout = setTimeout(function() {
    debug('Producer is about to close');
    closing = true;
    if (this.cancelLock) {
      this.cancelLock();
    } else {
      debug('already canceled/ended');
    }
  }.bind(this), ttl);
  this.cancelLock = lock('flower-power', function(er, rls) {
    if (er) {
      if (this.thunk) {
        this.thunk.cancel();
      }
      stopDiscoverThis(FlowerPower, this.filter);
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
    this.thunk = first([[this, 'data', 'error']], function(err, ee, evt) {
      debug('received %s, remove think, release', evt);
      rls();
      this.thunk = null;
      this.release = null;
      stopDiscoverThis(FlowerPower, this.filter);
    }.bind(this));

    discoverThis(FlowerPower, this.filter);
  }.bind(this));
});

module.exports = Producer;

Producer.prototype.onDiscover = function onDiscover(device) {
  stopDiscoverThis(FlowerPower, this.filter);
  debug('discovered device: ', device.uuid);
  var self = this;
  this.device = device;
  var peripheral = device._peripheral;
  var advertisement = peripheral.advertisement;
  var localName = advertisement.localName;
  var txPowerLevel = advertisement.txPowerLevel;
  var flowerPower = device;
  series([
    function(cb) {
      debug('connect and setup');
      flowerPower.connectAndSetup(cb);
    },
    function(cb) {
      debug('read soil temp');
      flowerPower.readSoilTemperature(cb);
    },
    function(cb) {
      debug('read calibrated soil');
      flowerPower.readCalibratedSoilMoisture(cb);
    },
    function(cb) {
      debug('read calibrated air temp');
      flowerPower.readCalibratedAirTemperature(cb);
    },
    function(cb) {
      debug('read sunlight');
      flowerPower.readCalibratedSunlight(cb);
    },
    function(cb) {
      debug('read ea');
      flowerPower.readCalibratedEa(cb);
    },
    function(cb) {
      debug('read ecb');
      flowerPower.readCalibratedEcb(cb);
    },
    function(cb) {
      debug('read ec porous');
      flowerPower.readCalibratedEcPorous(cb);
    },
    function(cb) {
      debug('read battery level');
      flowerPower.readBatteryLevel(cb);
    },
    function(cb) {
      debug('update rssi');
      flowerPower._peripheral.updateRssi(cb);
    },
    function(cb) {
      debug('disconnect');
      flowerPower.disconnect(cb);
    }
  ], function(err, data) {
    if (err) {
      self.emit('error', err);
      // do not return, maybe we have some data
    }
    data = data || [];
    // find mapping of data
    var soilTemp = data[1];
    var soilMoisture = data[2];
    var airTemp = data[3];
    var sunLight = data[4];
    var ea = data[5];
    var ecb = data[6];
    var ecPorous = data[7];
    var battery = data[8];
    var rssi = data[9];

    emit('temperature/soil', soilTemp);
    emit('temperature/air', airTemp);
    emit('soil/moisture', soilMoisture);
    emit('sunlight/value', sunLight);
    emit('ec/ea', ea);
    emit('ec/ecb', ecb);
    emit('ec/porous', ecPorous);
    emit('battery/level', battery);
    emit('rssi/level', rssi);
    self.device = null;
    function emit(service, metric, obj) {
      service = 'flowerpower/' + service;
      self.emit('data', deepextend({
        service: service,
        metric: metric,
        meta: {
          uuid: flowerPower.uuid,
          rssi: rssi,
          battery: battery,
          ea: ea,
          ecb: ecb,
          ecPorous: ecPorous,
          sunLight: sunLight,
          airTemp: airTemp,
          soilMoisture: soilMoisture,
          soilTemp: soilTemp
        },
        host: flowerPower.uuid,
        tags: ['device:flower-power', 'sensor']
      }, obj));
    }
  });
};
