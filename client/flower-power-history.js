'use strict';
var producer = require('godot-producer');
var FlowerPower = require('flower-power');
var series = require('run-series');
var debug = require('debug')('swg:device:flower-power-history');
var waterfall = require('run-waterfall');
require('./discover')(FlowerPower);
var Producer = producer(function ctor() {
  var uuid = this.uuid = options.uuid;
  debug('initialized flower power with %s', this.uuid || '<empty uuid>');
  this.filter = function(device) {
    if (!uuid) {
      debug('filtering %s, but no filter', device.uuid);
      this.onDiscover(device);
      return;
    }
    debug('filtering device: "%s" <=> "%s"', device.uuid, uuid);
    if (device.uuid === uuid) {
      this.onDiscover(device);
    }
  }.bind(this);
  this.on('error', console.error.bind(console));
}, function produce() {
  debug('producing, stopping and restarting discovery');
  FlowerPower.stopDiscoverThis(this.filter);
  if (this.device) {
    this.device.disconnect();
    this.device = null;
  }
  FlowerPower.discoverThis(this.filter);
});

module.exports = Producer;

Producer.prototype.onDiscover = function onDiscover(flowerPower) {
  var lastEntryIdx;
  var currentSessionID;
  var currentSessionStartIdx;
  var currentSessionPeriod;
  var startIdx;
  series([
    function(cb) {
      flowerPower.connectAndSetup(cb),
    },
    function(cb) {
      flowerPower.getHistoryLastEntryIdx(function(err, data) {
        lastEntryIdx = data;
        cb(err);
      });
    },
    function(cb) {
      flowerPower.getHistoryCurrentSessionID(function(err, data) {
        currentSessionID = data;
        cb(err);
      });
    },
    function(cb) {
      flowerPower.getHistoryCurrentSessionStartIdx(function(err, data) {
        currentSessionStartIdx = data;
        cb(err);
      });
    },
    function(cb) {
      flowerPower.getHistoryCurrentSessionPeriod(function(err, data) {
        currentSessionPeriod = data;
        cb(err);
      });
    },
    function(cb) {
      flowerPower.getStartupTime(cb);
    },
    function(cb) {
      startIdx = lastEntryIdx - 200;
      flowerPower.getHistory(startIdx, cb);
    },
  ], function(err, data) {
    if (err) {
      self.emit('error', err);
      // do not return, maybe we have some data
    }
    data = data || [];
    // find mapping of data
    var startupTime = data[5];
    var history = data[6];
    var time = new Date();
    var offset = time.getTimezoneOffset();
    self.emit('data', {
      service: 'flowerpower/history',
      meta: {
        history: history,
        startupTime: startupTime
      }
    });
    waterfall([
      function(cb) {
        cloud.auth({
          clientId: options.clientId,
          clientSecret: options.clientSecret,
          username: options.username,
          password: options.password
        }, cb)
      },
      function(token, cb) {
        cloud.upload({
          history: history,
          token: token
        }, cb)
      }
    ], function(err, result) {
      if (err) {
        return self.emit('error', err);
      }
    });
  });

};
