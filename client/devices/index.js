var MiniBeacon = require('./minibeacon');
var SensorTag = require('./sensortag');
var FlowerPower = require('./flower-power');
module.exports = function(peripheral) {
  if (MiniBeacon.is(peripheral)) {
    return new MiniBeacon(peripheral);
  }
  if (SensorTag.is(peripheral)) {
    return new SensorTag(peripheral);
  }
  if (FlowerPower.is(peripheral)) {
    return new FlowerPower(peripheral);
  }
}