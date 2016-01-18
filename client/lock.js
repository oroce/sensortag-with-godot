'use strict';
var mutexify = require('mutexify');
var locks = {};
module.exports = function(key, cb) {
  if (locks[key] == null) {
    locks[key] = mutexify();
  }
  return locks[key](cb);
};
