'use strict';

var producer = require('godot-producer');
var SensorTag = require('sensortag').CC2540;
var NobleDevice = require('sensortag/node_modules/noble-device');
NobleDevice.Util.mixin(SensorTag, NobleDevice.BatteryService);
var debug = require('debug')('swg:device:sensortag');
SensorTag.SCAN_DUPLICATES = true;
var series = require('run-series');
require('./discover')(SensorTag);

var Producer = producer(function ctor(options) {
  var uuid = this.uuid = options.uuid;
  debug('initialized sensortag with %s', this.uuid || '<empty uuid>');
  this.filter = function(device) {
    if (!uuid) {
      debug('filtering %s, but no filter', device.uuid);
      this.onDiscover(device);
      return;
    }
    debug('filtering device: "%s" <=> "%s"', device.uuid, uuid);
    if (device.uuid === uuid) {
      this.onDiscover(device);
    }
  }.bind(this);
  this.on('error', console.error.bind(console));
}, function produce() {
  debug('producing, stopping and restarting discovery');
  SensorTag.stopDiscoverThis(this.filter);
  if (this.device) {
    this.device.disconnect();
    this.device = null;
  }
  SensorTag.discoverThis(this.filter);
});
module.exports = Producer

Producer.prototype.onDiscover = function onDiscover(device) {
  SensorTag.stopDiscoverThis(this.filter);
  debug('discovered device: ', device.uuid);
  var self = this;
  this.device = device;
  var peripheral = device._peripheral;
  var advertisement = peripheral.advertisement;
  var localName = advertisement.localName;
  var txPowerLevel = advertisement.txPowerLevel;
  series([
    function(cb) {
      debug('connecting and setup');
      device.connectAndSetup(cb);
    },
    function(cb) {
      debug('enable ir temperature');
      device.enableIrTemperature(cb);
    },
    function(cb) {
      debug('enable humidity');
      device.enableHumidity(cb);
    },
    function(cb) {
      debug('read ir temperature');
      device.readIrTemperature(function(err, object, ambient) {
        if (err) return cb(err);
        cb(null, {
          object: object,
          ambient: ambient
        });
      });
    },
    function(cb) {
      debug('read humidity');
      device.readHumidity(function(err, temperature, humidity) {
        if (err) return cb(err);
        cb(null, {
          temperature: temperature,
          humidity: humidity
        });
      });
    },
    function(cb) {
      debug('read battery level');
      if (device._peripheral.advertisement.serviceUuids.indexOf('180f') === -1) {
        return cb();
      }
      device.readBatteryLevel(cb);
    },
    function(cb) {
      debug('update rssi');
      device._peripheral.updateRssi(cb);
    }
  ], function(err, results) {
    if (err) {
      self.emit('error', err);
      // do not return, maybe we could grab some data
    }
    debug('data arrived: %j (%s)', results, err || '<no error>');
    results || (results = []);
    var temp = results[3];
    var humidity = results[4];
    var battery = results[5];
    var rssi = results[6];

    self.emit('data', {
      service: 'state/connected',
      host: device.uuid,
      meta: {
        uuid: device.uuid,
        tx: txPowerLevel,
        rssi: rssi
      },
      tags: ['st-connection']
    });

    if (temp && temp.ambient !== 0) {
      self.emit('data', {
        host: device.uuid,
        service: 'temperature/ambient',
        meta: {
          uuid: device.uuid,
          rssi: rssi,
          battery: battery
        },
        tags: ['st-metric'],
        metric: temp.ambient
      });
    }

    if (humidity) {
      self.emit('data', {
        host: device.uuid,
        service: 'humidity/humidity',
        meta: {
          uuid: device.uuid,
          rssi: rssi,
          battery: battery
        },
        tags: ['st-metric'],
        metric: humidity.humidity
      });
    }

    self.emit('data', {
      host: device.uuid,
      service: 'rssi',
      meta: {
        uuid: device.uuid,
        rssi: rssi,
        battery: battery
      },
      tags: ['st-technical'],
      metric: rssi
    });

    self.emit('data', {
      host: device.uuid,
      service: 'battery',
      meta: {
        uuid: device.uuid,
        rssi: rssi,
        battery: battery
      },
      tags: ['st-technical'],
      metric: battery
    });

    if (self.device) {
      self.device.disconnect();
      self.device = null;
    }
  });
};
