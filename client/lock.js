'use strict';
var mutexify = require('mutexify');
var debug = require('debug')('swg:lock');
var locks = {};
module.exports = function(key, cb) {
  if (locks[key] == null) {
    debug('new instance of lock for %s', key);
    locks[key] = mutexify();
  }
  var lock = setup(cb);
  locks[key](lock.cb);
  return lock.cancel;
};


function setup(cb) {
  var done = false;
  var release;
  function cancel() {
    done = true;
    cb(new Error('Already canceled'));
  }
  function next() {
    if (done) {
      return;
    }
    if (release) {
      done = true;
      release();
    }
  }
  function lockReceived(rls) {
    if (done) {
      cb(new Error('Already canceled'));
      rls();
      return;
    }
    release = rls;
    cb(null, next);
  }
  return {
    cancel: cancel,
    cb: lockReceived
  };

}
