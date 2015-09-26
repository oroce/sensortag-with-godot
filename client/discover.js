'use strict';

var noble = require('noble');
var debug = require('debug')('swg:discover');
module.exports = mixin;

function discoverThis(callback) {
  var constructor = this;
  debug('discover this');
  constructor.emitter.addListener('discover', callback);
  if (constructor.emitter.listeners('discover').length === 1) {
    noble.on('discover', constructor.onDiscover);
    noble.on('stateChange', constructor.onStateChange);

    if (noble.state === 'poweredOn') {
      constructor.startScanning();
    }
  }
}

function stopDiscoverThis(discoverCallback) {
  var constructor = this;
  debug('stop discover this');
  constructor.emitter.removeListener('discover', discoverCallback);
  if (constructor.emitter.listeners('discover').length === 0) {
    noble.removeListener('discover', constructor.onDiscover);
    noble.removeListener('stateChange', constructor.onStateChange);
  }
}

function mixin(constructor) {
  constructor.discoverThis = constructor.discoverThis || discoverThis;
  constructor.stopDiscoverThis = constructor.stopDiscoverThis || stopDiscoverThis;
}
