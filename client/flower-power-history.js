'use strict';
var producer = require('godot-producer');
var FlowerPower = require('flower-power');
var series = require('run-series');
var waterfall = require('run-waterfall');
var debug = require('debug')('swg:device:flower-power-history');
var cloud = require('./cloud');
require('./discover')(FlowerPower);
var Producer = producer(function ctor(options) {
  options = (options || {});
  this.options = options;
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
  var options = this.options;
  var self = this;
  var lastEntryIdx;
  var currentSessionID;
  var currentSessionStartIdx;
  var currentSessionPeriod;
  var startIdx;
  debug('discovered device: %s', flowerPower.uuid);
  series([
    function(cb) {
      debug('Connect and setup');
      flowerPower.connectAndSetup(function(err, result) {
        debug('connect and setup ended (%s, %j)', err, result);
        cb(err, result);
      });
    },
    function(cb) {
      flowerPower.readFirmwareRevision(cb);
    },
    function(cb) {
      flowerPower.readHardwareRevision(cb);
    },
    function(cb) {
      debug('getting last history entry idx');
      flowerPower.getHistoryLastEntryIdx(function(err, data) {
        debug('got last history entry idx (%s, %j)', err, data);
        lastEntryIdx = data;
        cb(err);
      });
    },
    function(cb) {
      debug('getting history current session idx');
      flowerPower.getHistoryCurrentSessionID(function(err, data) {
        debug('got history current session idx (%s, %j)', err, data);
        currentSessionID = data;
        cb(err);
      });
    },
    function(cb) {
      debug('getting history current session start idx');
      flowerPower.getHistoryCurrentSessionStartIdx(function(err, data) {
        debug('got history current session start idx (%s, %j)', err, data);
        currentSessionStartIdx = data;
        cb(err);
      });
    },
    function(cb) {
      debug('getting history current session period');
      flowerPower.getHistoryCurrentSessionPeriod(function(err, data) {
        debug('got history current session period (%s, %j)', err, data);
        currentSessionPeriod = data;
        cb(err);
      });
    },
    function(cb) {
      debug('getting startup time');
      flowerPower.getStartupTime(function(err, data) {
        debug('got startup time (%s, %j)', err, data);
        cb(err, data);
      });
    },
    function(cb) {
      startIdx = lastEntryIdx - 200;
      debug('getting history');
      flowerPower.getHistory(startIdx, function(err, data) {
        debug('got history (%s)', err);
        cb(err, data);
      });
    },
  ], function(err, data) {
    if (err) {
      self.emit('error', err);
      // do not return, maybe we have some data

    }
    data = data || [];
    // find mapping of data
    var startupTime = data[7];
    var history = data[8];
    var firmwareVersion = data[1];
    var hardwareVersion = data[2];
    var time = new Date();
    if (!history) {
      debug('Failed to get history');
      return;
    }
    var offset = time.getTimezoneOffset();
    self.emit('data', {
      service: 'flowerpower/history',
      meta: {
        history: history,
        startupTime: startupTime
      }
    });
    debug('Data arrived, starting auth and upload phase');
    waterfall([
      cloud.auth.bind(cloud, {
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        username: options.username,
        password: options.password
      }),
      /*function(token, cb) {
        cloud.garden({
          token: token
        }, function(err, params) {
          if (err) {
            return cb(err);
          }
          params.token = token;
          cb(null, params);
        });
      },*/
      function(token, cb) {
        var params = {};
        params.token = token;
        params.history = history;
        params.currentId = currentSessionID;
        params.startupTime = startupTime;
        params.currentSessionStartIdx = currentSessionStartIdx;
        params.currentSessionPeriod = currentSessionPeriod;
        params.userConfigVersion = 8;
        params.serial = 'A0143D000008DC92'; // wtf why no device.uuid
        params.hardwareVersion = hardwareVersion.substr(0, (hardwareVersion.indexOf('\u0000')) ? hardwareVersion.indexOf('\u0000') : hardwareVersion.length);
        params.firmwareVersion = firmwareVersion.substr(0, (firmwareVersion.indexOf('\u0000')) ? firmwareVersion.indexOf('\u0000') : firmwareVersion.length);

        debug('upload about to start');
        cloud.upload(params, cb);
      }
    ], function(err, result) {
      if (err) {
        self.emit('error', err);
        self.emit('data', {
          service: 'flowerpower/history-uploaded',
          state: 'error',
          meta: err
        });
        return;
      }
      console.log('result', result);
      self.emit('data', {
        service: 'flowerpower/history-uploaded',
        state: 'ok',
        meta: result
      });
    });
  });
};
