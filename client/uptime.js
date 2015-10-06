'use strict';
var os = require('os');
var hostname = os.hostname();
var ago = require('time-ago')().ago;
var producer = require('godot-producer');
var debug = require('debug')('swg:service:uptime');
var uptimeInSeconds = os.uptime();
var uptime = new Date(Date.now() - (uptimeInSeconds * 1000));

module.exports = producer(
  function ctor(options) {
    options = options || {};
    debug('Uptime ctor: %j', options);
    this.options = options;
  },
  function produce() {
    var servicePrefix = this.options.service;
    var service = (servicePrefix ? servicePrefix + '/' : '') + 'uptime';
    debug('New uptime event for %s is %s', service, uptime);
    this.emit('data', {
      service: service,
      metric: uptime.valueOf(),
      description: hostname + ' is rebooted ' + ago(uptime)
    });
  }
);
