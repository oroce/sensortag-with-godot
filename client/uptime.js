'use strict';
var os = require('os');
var hostname = os.hostname();
var ago = require('time-ago')().ago;
var producer = require('godot-producer');
var debug = require('debug')('swg:service:uptime');
var uptime;
try {
  uptime = require('./uptime/linux');
} catch (x) {
  uptime = require('./uptime/node');
}

module.exports = producer(
  function ctor(options) {
    options = options || {};
    debug('Uptime ctor: %j', options);
    this.options = options;
  },
  function produce() {
    var servicePrefix = this.options.service;
    var service = (servicePrefix ? servicePrefix + '/' : '') + 'uptime';
    debug('New uptime event for %s is %s', service, new Date(uptime));
    this.emit('data', {
      service: service,
      metric: uptime,
      description: hostname + ' is rebooted ' + ago(uptime)
    });
  }
);
