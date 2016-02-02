'use strict';

var noble = require('noble');
var debug = require('debug')('swg:discover');
module.exports = mixin;

function logEvents(constructor) {
  var evts = constructor.emitter._events;
  var len = Object.keys(evts).length;
  if (len === 0) {
    debug('No events attached to noble');
  }
  Object.keys(evts).forEach(function(evt) {
    var val = evts[evt];
    var arr = Array.isArray(val) ? val : [val];

    debug('\tevent: %s has %s listeners', evt, arr.length);
    arr.forEach(function(func) {
      debug('\t\t%s eventlistener is %s (%s)', evt, func.name || 'unnamed', func.toString());
    });
  });
}
function discoverThis(callback) {
  var constructor = this;
  debug('discover this');
  logEvents(constructor);
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
  logEvents(constructor);
  constructor.emitter.removeListener('discover', discoverCallback);
  logEvents(constructor);
  debug('stop discover this removed the event');
  if (constructor.emitter.listeners('discover').length === 0) {
    noble.removeListener('discover', constructor.onDiscover);
    noble.removeListener('stateChange', constructor.onStateChange);
  }
}

function mixin(constructor) {
  constructor.discoverThis = constructor.discoverThis || discoverThis;
  constructor.stopDiscoverThis = constructor.stopDiscoverThis || stopDiscoverThis;
}

mixin.discoverThis = function(ctor, cb) {
  discoverThis.call(ctor, cb);
};
mixin.stopDiscoverThis = function(ctor, cb) {
  stopDiscoverThis.call(ctor, cb);
};
