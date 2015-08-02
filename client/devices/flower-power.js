var FlowerPowerDevice = require('flower-power');
var util = require('util');
var series = require('run-series');

function FlowerPower(peripheral) {
  FlowerPowerDevice.call(this, peripheral);
}

FlowerPower.SCAN_DUPLICATES = FlowerPowerDevice.SCAN_DUPLICATES;
FlowerPower.is = FlowerPowerDevice.is;

util.inherits(FlowerPower, FlowerPowerDevice);

function initialize(cb) {
  var tag = this;
  return cb();
  console.log('FLOWER POWER CONNECT AND SETUP');
  series([
    tag.connectAndSetup.bind(tag),
    tag.enableLiveMode.bind(tag)
  ], function(err, result) {
    console.log('FLOWER POWER CONNECT AND SETUP ENDED');
    if (err) {
      tag.disconnect();
      cb(err);
      return;
    }
    cb(null, result);
    tag.emit('initialized');
  });
}
FlowerPower.prototype.initialize = initialize;

function measure(cb) {
  var device = this;
  var shift = function(method, peripheral) {
    return function(fn) {
      console.log('doing %s', method);
      (peripheral || device)[method](function(level, shifted) {
        console.log('Shift of %s, 1st: %s, 2nd: %s', method, level, shifted);
        fn(null, level || shifted);
      });
    };
  };
  console.log(device);
  series([
    device.connectAndSetup.bind(device),
    shift('readBatteryLevel'),
    shift('readSunlight'),
    shift('readSoilTemperature'),
    shift('readAirTemperature'),
    shift('readSoilMoisture'),
    shift('updateRssi', device._peripheral),
  ], function(err, results) {
    if (err) {
      return cb(err);
    }
    console.log('what weve got', results)
    cb(null, {
      battery: results[0],
      sunlight: results[1],
      soilTemp: results[2],
      airTemp: results[3],
      soilMoisture: results[4],
      rssi: results[5]
    });
  });
}
FlowerPower.prototype.measure = measure;

module.exports = FlowerPower;

