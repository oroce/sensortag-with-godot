'use strict';
var producer = require('godot-producer');
var FlowerPower = require('flower-power');
var series = require('run-series');
var waterfall = require('run-waterfall');
var debug = require('debug')('swg:device:flower-power-history');
var cloud = require('./cloud');
var first = require('ee-first');
var lock = require('./lock');
var discover = require('./discover');
discover(FlowerPower);
var stopDiscoverThis = function(that, cb) {
  return discover.stopDiscoverThis(that, cb, debug);
};
var discoverThis = function(that, cb) {
  return discover.discoverThis(that, cb, debug);
};
var Producer = producer(function ctor(options) {
  options = (options || {});
  var self = this;
  this.options = options;
  var uuid = this.uuid = options.uuid;
  debug('initialized flower power with %s (%j)', this.uuid || '<empty uuid>', options);
  this.filter = function fphFilter(device) {
    if (!uuid) {
      debug('filtering %s, but no filter', device.uuid);
      self.onDiscover(device);
      return;
    }
    debug('filtering device: "%s" <=> "%s"', device.uuid, uuid);
    if (device.uuid === uuid) {
      self.onDiscover(device);
    }
  };
  this.on('error', console.error.bind(console));
}, function produce() {
  var hasDevice = this.device != null;
  var hasLock = this.release != null;
  var options = this.options;
  clearTimeout(this.timeout);
  debug('producing, stopping and restarting discovery (device=%s,lock=%s)', hasDevice, hasLock);
  stopDiscoverThis(FlowerPower, this.filter);
  if (this.device) {
    debug('disconnecting device');
    this.device.disconnect();
    this.device = null;
  }
  if (this.cancelLock) {
    debug('cancelling lock');
    this.cancelLock();
  }
  if (this.release) {
    debug('releasing lock');
    this.release();
  }
  if (this.thunk) {
    debug('cancelling thunk');
    this.thunk.cancel();
  }
  var closing = false;
  var ttl = options.ttl / 2;
  debug('Waiting %sms till close', ttl);
  this.timeout = setTimeout(function() {
    debug('Producer is about to close');
    closing = true;
    if (this.cancelLock) {
      this.cancelLock();
    } else {
      debug('already cancelled/ended');
    }
  }.bind(this), ttl);
  this.cancelLock = lock('flower-power', function (er, rls) {
    if (er) {
      return this.emit('error', er);
    }
    if (closing) {
      debug('producer is closing');
      rls();
      return;
    }
    clearTimeout(this.timeout);
    debug('lock received');
    this.release = rls;
    this.thunk = first([[this, 'data', 'error']], function(err, ee, evt) {
      debug('received %s, remove think, release', evt);
      rls();
      this.thunk = null;
      this.release = null;
      stopDiscoverThis(FlowerPower, this.filter);
    }.bind(this));
    discoverThis(FlowerPower, this.filter);
  }.bind(this));
});
module.exports = Producer;

Producer.prototype.onDiscover = function onDiscover(flowerPower) {
  stopDiscoverThis(FlowerPower, this.filter);
  var options = this.options;
  var self = this;
  var lastEntryIdx;
  var currentSessionID;
  var currentSessionStartIdx;
  var currentSessionPeriod;
  var startIdx;
  this.device = flowerPower;
  var uuid = flowerPower.id || flowerPower.uuid;
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
      debug('getting system id');
      flowerPower.readSystemId(function(err, sysId) {
        debug('got system id (%s, %j)', err, sysId);
        cb(err, sysId);
      });
    },
    function(cb) {
      startIdx = lastEntryIdx - 200;
      debug('getting history: %s', startIdx);
      flowerPower.getHistory(startIdx, function(err, data) {
        debug('got history (%s)', err);
        cb(err, data);
      });
    },
    function(cb) {
      debug('disconnect');
      flowerPower.disconnect(cb);
    }
  ], function(err, data) {
    if (err) {
      self.emit('error', err);
      // do not return, maybe we have some data

    }
    self.device = null;
    data = data || [];
    // find mapping of data
    var startupTime = data[7];
    var systemId = data[8];
    var serial = systemId.replace(/:/gm, '').toUpperCase();
    var history = data[9];
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
      host: uuid,
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
        params.serial = serial; // wtf why no device.uuid
        params.hardwareVersion = hardwareVersion.substr(0, (hardwareVersion.indexOf('\u0000')) ? hardwareVersion.indexOf('\u0000') : hardwareVersion.length);
        params.firmwareVersion = firmwareVersion.substr(0, (firmwareVersion.indexOf('\u0000')) ? firmwareVersion.indexOf('\u0000') : firmwareVersion.length);

        debug('upload about to start with params=%j', params);
        cloud.upload(params, cb);
      }
    ], function(err, result) {
      if (err) {
        self.emit('error', err);
        self.emit('data', {
          service: 'flowerpower/history-uploaded',
          host: uuid,
          state: 'error',
          meta: err
        });
        return;
      }

      self.emit('data', {
        service: 'flowerpower/history-uploaded',
        state: 'ok',
        host: uuid,
        meta: result
      });
    });
  });
};
