'use strict';
var NMA = require('notify-my-android');
var util = require('util');
var ReadWriteStream = require('godot').common.ReadWriteStream;

var NotifyMyAndroid = module.exports = function NotifyMyAndroid(options) {
  if (!(this instanceof NotifyMyAndroid)) { return new NotifyMyAndroid(options) }
  
  options || (options = {});
  ReadWriteStream.call(this);

  this.client  = options.client || new NMA(options.key);
  
  this.format = options.format || this._format;
};

util.inherits(NotifyMyAndroid, ReadWriteStream);

NotifyMyAndroid.prototype._format = function (data) {
  return {
    application: data.service,
    event: data.service + ' is ' + data.state,
    description: data.description,
    options: {}
  };
};

NotifyMyAndroid.prototype.write = function (data) {
  var self   = this;
  var format = this.format(data);
  console.log('[nma]', format);
  this.client.notify(
    format.application,
    format.event,
    format.description,
    format.options,
    function(err) {
      if (err) {
        return self.emit('reactor:error', err);
      }
    }
  );

  this.emit('data', data);
};
