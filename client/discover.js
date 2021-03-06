'use strict';

var noble = require('noble');
var debugMe = require('debug')('swg:discover');
module.exports = mixin;

function logEvents (constructor, expand, dbg) {
  var debug = dbg || debugMe;
  var evts = constructor.emitter._events;
  var len = Object.keys(evts).length;
  if (len === 0) {
    debug('No events attached to noble');
  }
  Object.keys(evts).forEach(function (evt) {
    var val = evts[evt];
    var arr = Array.isArray(val) ? val : [val];

    debug('\tevent: %s has %s listeners', evt, arr.length);
    if (expand === false) {
      return;
    }
    arr.forEach(function (func) {
      debug('\t\t%s eventlistener is %s (%s)', evt, func.name || 'unnamed', func.toString());
    });
  });
}
function discoverThis (callback, dbg) {
  var constructor = this;
  var debug = dbg || debugMe;
  debug('discover this');
  logEvents(constructor, true, debug);
  constructor.emitter.addListener('discover', callback);
  var discoverListeners = noble.listeners('discover');
  var stateListeners = noble.listeners('stateChange');
  if (!~discoverListeners.indexOf(constructor.onDiscover)) {
    noble.on('discover', constructor.onDiscover);
  }
  if (!~stateListeners.indexOf(constructor.onStateChange)) {
    noble.on('stateChange', constructor.onStateChange);
  }
  if (noble.state === 'poweredOn') {
    noble.startScanning([], false);
  }
}

function stopDiscoverThis (discoverCallback, dbg) {
  var constructor = this;
  var debug = dbg || debugMe;
  debug('stop discover this');
  logEvents(constructor, false, debug);
  var oldCount = constructor.emitter.listeners('discover').length;
  constructor.emitter.removeListener('discover', discoverCallback);
  var newCount = constructor.emitter.listeners('discover').length;
  if (oldCount === 0 && newCount === 0) {
    debug('booting up, no events yet');
  } else if (oldCount === newCount) {
    debug('ACHTUNG!!! removeListener wasn\'t able to remove cb');
    debug('We tried to remove: %s of %s: %s', discoverCallback.name, constructor.name, discoverCallback.toString());
    logEvents(constructor, true, debug);
  } else {
    debug('Discover listeners count went from %s to %s', oldCount, newCount);
    logEvents(constructor, false, debug);
  }
  if (constructor.emitter.listeners('discover').length === 0) {
    noble.removeListener('discover', constructor.onDiscover);
    noble.removeListener('stateChange', constructor.onStateChange);
  }
}

function mixin (constructor) {
  constructor.discoverThis = constructor.discoverThis || discoverThis;
  constructor.stopDiscoverThis = constructor.stopDiscoverThis || stopDiscoverThis;
}

mixin.discoverThis = function (ctor, cb, dbg) {
  discoverThis.call(ctor, cb, dbg);
};
mixin.stopDiscoverThis = function (ctor, cb, dbg) {
  stopDiscoverThis.call(ctor, cb, dbg);
};
