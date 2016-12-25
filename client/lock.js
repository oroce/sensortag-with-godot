'use strict';
var mutexify = require('mutexify');
var debug = require('debug')('swg:lock');
var locks = {};
module.exports = function (key, cb) {
  if (locks[key] == null) {
    debug('new instance of lock for %s', key);
    locks[key] = mutexify();
  }
  var lock = setup(cb);
  debug('before acquire, the queue is at: %s', locks[key].queue && locks[key].queue.length);
  locks[key](lock.cb);
  return lock.cancel;
};

function setup (cb) {
  var done = false;
  var release;
  function cancel () {
    done = true;
    debug('cancelling lock');
    cb(new Error('Already canceled'));
    if (release) {
      release();
    }
  }
  function next () {
    debug('worker is done (are we done=%s, has rls=%s)', done, !!release);
    if (done) {
      return;
    }
    if (release) {
      done = true;
      release();
    }
  }
  function lockReceived (rls) {
    if (done) {
      cb(new Error('Lock received, but already canceled'));
      rls();
      return;
    }
    release = rls;
    debug('Lock received, handed out');
    cb(null, next);
  }
  return {
    cancel: cancel,
    cb: lockReceived
  };
}
