var SensorTagDevice = require('sensortag').CC2540;
var util = require('util');
var series = require('run-series');
var BatteryService = require('sensortag/node_modules/noble-device').BatteryService;

function SensorTag(peripheral) {
  SensorTagDevice.call(this, peripheral);
}

SensorTag.SCAN_DUPLICATES = true;
SensorTag.is = SensorTagDevice.is;

util.inherits(SensorTag, SensorTagDevice);

function initialize(cb) {
  var tag = this;
  series([
    function(cb) {
      tag.connect(cb);
    },
    function(cb) {
      tag.discoverServicesAndCharacteristics(cb);
    },
    function(cb) {
      tag.enableIrTemperature(cb);
    },
    function(cb) {
      tag.enableHumidity(cb);
    }
  ], function(err, result) {
    if (err) {
      tag.disconnect();
      cb(err);
      return;
    }
    cb(null, result);
    tag.emit('initialized');
  });
}
SensorTag.prototype.initialize = initialize;

function measure(cb) {
  var device = this;
  series([
    function(cb) {
      device.readIrTemperature(function(err, object, ambient) {
        if (err) return cb(err);
        cb(null, {
          object: object,
          ambient: ambient
        });
      });
    },
    function(cb) {
      device.readHumidity(function(err, temperature, humidity) {
        if (err) return cb(err);
        cb(null, {
          temperature: temperature,
          humidity: humidity
        });
      });
    },
    function(cb) {
      if (device._peripheral.advertisement.serviceUuids.indexOf('180f') === -1) {
        return cb();
      }
      device.readBatteryLevel(cb);
    },
    function(cb) {
      device._peripheral.updateRssi(cb);
    }
  ], function(err, results) {
    if (err) {
      return cb(err);
    }
    var temp = results[0];
    var humidity = results[1];
    var battery = results[2]
    var rssi = results[3];

    cb(null, {
      temp: temp,
      humidity: humidity,
      battery: battery,
      rssi: rssi
    });
  });
}
SensorTag.prototype.measure = measure;

SensorTag.prototype.readBatteryLevel = BatteryService.prototype.readBatteryLevel;
module.exports = SensorTag;

