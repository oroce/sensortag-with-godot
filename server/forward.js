'use strict';
var godot = require('godot');
var ReadWriteStream = godot.common.ReadWriteStream;
var util = require('util');
var reconnect = require('reconnect-net');
function Forward (options) {
  if (!(this instanceof Forward)) {
    return new Forward(options);
  }
  options = options || {};
  if (options.type === 'udp') {
    return godot.forward(options);
  }
  ReadWriteStream.call(this);
  this._queue = [];
  var self = this;
  this.reconnect = reconnect(function (stream) {
    var item;
    while (self._queue.length > 0) {
      item = self._queue.shift();
      stream.write(item + '\n');
    }
    self.socket = stream;
  }).on('disconnect', function () {
    self.socket = null;
  }).on('error', function (err) {
    self.emit('error', err);
    self.socket = null;
  });

  this.reconnect.connect(options.port, options.host);
}

util.inherits(Forward, ReadWriteStream);

module.exports = Forward;

Forward.prototype.write = function (data) {
  var raw = JSON.stringify(data);
  if (this.socket) {
    this.socket.write(raw + '\n');
  } else {
    this._queue.push(raw);
  }
  this.emit('data', data);
};

Forward.prototype.end = function end () {
  if (this.socket) {
    this.socket.end();
  }
};
