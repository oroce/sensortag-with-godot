'use strict';
var producer = require('godot-producer');
var FlowerPower = require('flower-power');
var series = require('run-series');
var deepextend = require('deep-extend');
var debug = require('debug')('swg:device:flower-power');
var Producer = producer(function ctor() {
  this.uuid = options.uuid;
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
  FlowerPower.stopDiscoverAll(this.filter);
  if (this.device) {
    this.device.disconnect();
    this.device = null;
  }
  FlowerPower.discoverAll(this.filter);
});

module.exports = Producer;

Producer.prototype.onDiscover = function onDiscover(device) {
  SensorTag.stopDiscoverAll(this.filter);
  debug('discovered device: ', device.uuid);
  var self = this;
  this.device = device;
  var peripheral = device._peripheral;
  var advertisement = peripheral.advertisement;
  var localName = advertisement.localName;
  var txPowerLevel = advertisement.txPowerLevel;
  series([
    function(cb) {
      flowerPower.connectAndSetup(cb);
    },
    function(cb) {
      flowerPower.readSoilTemperature(cb);
    },
    function(cb) {
      flowerPower.readCalibratedSoilMoisture(cb);
    },
    function(cb) {
      flowerPower.readCalibratedAirTemperature(cb);
    },
    function(cb) {
      flowerPower.readCalibratedSunlight(cb);
    },
    function(cb) {
      flowerPower.readCalibratedEa(cb);
    },
    function(cb) {
      flowerPower.readCalibratedEcb(cb);
    },
    function(cb) {
      flowerPower.readCalibratedEcPorous(cb);
    },
    function(cb) {
      flowerPower.readBatteryLevel(cb);
    },
    function(cb) {
      flowerPower._peripheral.updateRssi(cb);
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
    emit('sunlight/value', sunLight);
    emit('ec/ea', ea);
    emit('ec/ecb', ecb);
    emit('ec/porous', ecPorous);
    self.device.disconnect();
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