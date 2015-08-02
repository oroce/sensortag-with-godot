var MiniBeaconDevice = require('minew-minibeacon');
var util = require('util');

function MiniBeacon() {
  MiniBeaconDevice.apply(this, arguments);
}

MiniBeacon.SCAN_DUPLICATES = true;
MiniBeacon.is = MiniBeaconDevice.is;

util.inherits(MiniBeacon, MiniBeaconDevice);

function initialize() {
  var tag = this;
  tag.connectAndSetup(function(err, result) {
    if (err) {
      tag.disconnect();
      cb(err);
      return;
    }
    cb(null, result);
    tag.emit('initialized');
  });
}
MiniBeacon.prototype.initialize = initialize;

function measure() {

}
MiniBeacon.prototype.measure = measure;

module.exports = MiniBeacon;

