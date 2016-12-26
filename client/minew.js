'use strict';

'use strict';

var producer = require('godot-producer');
var MiniBeacon = require('minew-minibeacon');
var debug = require('debug')('swg:device:minibeacon');
var series = require('run-series');
require('./discover')(MiniBeacon);

var Producer = producer(function ctor (options) {
  var uuid = this.uuid = options.uuid;
  debug('initialized MiniBeacon with %s', this.uuid || '<empty uuid>');
  this.filter = function (device) {
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
}, function produce () {
  debug('producing, stopping and restarting discovery');
  MiniBeacon.stopDiscoverThis(this.filter);
  if (this.device) {
    this.device.disconnect();
    this.device = null;
  }
  MiniBeacon.discoverThis(this.filter);
});

module.exports = Producer;

Producer.prototype.onDiscover = function onDiscover (device) {
  MiniBeacon.stopDiscoverThis(this.filter);
  debug('discovered device: ', device.uuid);
  var self = this;
  this.device = device;
  var peripheral = device._peripheral;
  var advertisement = peripheral.advertisement;
  var txPowerLevel = advertisement.txPowerLevel;
  series([
    function (cb) {
      device.connectAndSetup(cb);
    },
    function (cb) {
      device.readBatteryLevel(cb);
    },
    function (cb) {
      device._peripheral.updateRssi(cb);
    }
  ], function (err, results) {
    if (err) {
      self.emit('error', err);
      // do not return, maybe we could grab some data
    }
    results || (results = []);
    var battery = results[1];
    var rssi = results[2];

    self.emit('data', {
      service: 'state/connected',
      host: device.uuid,
      meta: {
        uuid: device.uuid,
        tx: txPowerLevel,
        rssi: rssi
      },
      tags: ['minibeacon-connection']
    });

    self.emit('data', {
      host: device.uuid,
      service: 'rssi',
      meta: {
        uuid: device.uuid,
        rssi: rssi,
        battery: battery
      },
      tags: ['minibeacon-technical'],
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
      tags: ['minibeacon-technical'],
      metric: battery
    });

    self.device.disconnect();
    self.device = null;
  });
};
