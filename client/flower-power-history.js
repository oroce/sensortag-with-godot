'use strict';
var producer = require('godot-producer');
var FlowerPower = require('flower-power');
var series = require('run-series');
module.exports = producer(function ctor() {
  this.uuid = options.uuid;
}, function produce() {
  var self = this;
  if (this._stillProducing) {
    //
  }
  this._stillProducing = true;
  if (this.uuid) {
    FlowerPower.discoverByUuid(this.uuid, onDiscover);
  } else {
    FlowerPower.discover(onDiscover);
  }

  function onDiscover(flowerPower) {
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
      series([
        cloud.auth,
        cloud.garden,
        cloud.upload
      ], function(err, result) {
        if (err) {
          return self.emit('error', err);
        }
      });
      delete self._stillProducing;
    });

  };
});
