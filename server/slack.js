var request = require('request');
var godot = require('godot');
var ReadWriteStream = godot.common.ReadWriteStream;
var debug = require('debug')('godot-reactor:slack');
var util = require('util');

function Slack (options) {
  if (!(this instanceof Slack)) {
    return new Slack(options);
  }
  if (!options || !options.token || !options.channel) {
    if (options.disabled !== true) {
      throw new Error('options.token, option.channel are mandatory!');
    }
  }
  ReadWriteStream.call(this);

  this.token = options.token;
  this.channel = options.channel;
  this.formatter = options.formatter || formatter;
  this.disabled = options.disabled;
}

util.inherits(Slack, ReadWriteStream);

module.exports = Slack;

Slack.prototype.write = function write (data) {
  if (this.disabled) {
    debug('wont send any data to slack due it\'s disabled');
    return;
  }
  var self = this;
  var message = this.formatter(data);
  debug('Adding to channel %s the message: %s', this.channel, message);
  request({
    url: 'https://slack.com/api/chat.postMessage',
    method: 'POST',
    form: {
      token: this.token,
      channel: this.channel,
      text: message
    },
    json: true
  }, function (err, resp, body) {
    if (err) {
      this.emit('error', err);
      debug('failed to send slack message: %s\nmessage: %j\ninput: %j', err, body, {
        data: data,
        message: message,
        channel: self.channel
      });
      return;
    }
    debug('Message (%s) sent successfully: %s', message, body);
  });
};
function formatter (data) {
  return data.description;
}
