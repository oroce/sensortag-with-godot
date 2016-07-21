'use strict';
var godot = require('godot');
var ReadWriteStream = godot.common.ReadWriteStream;
var util = require('util');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var debug = require('debug')('godot-reactor:email');
function Email(options) {
  if (!(this instanceof Email)) {
    return new Email(options)
  }
  if (!options || !options.auth || !options.from || !options.to) {
    throw new Error('options.auth, options.to, options.from are mandatory!');
  }
  ReadWriteStream.call(this);
  this.subject = options.subject || subject;
  this.body = options.body || body;
  this.to = options.to;
  this.from = options.from;
  delete options.from;
  delete options.to;
  this.transporter = nodemailer.createTransport(smtpTransport(options));
}

util.inherits(Email, ReadWriteStream);

module.exports = Email;

Email.prototype.write = function write(data) {
  var self = this;
  var subj = this.subject(data, this.lastMetric);
  var text = this.body(data, lastMetric);
  var opts = {
    to: this.to,
    from: this.from,
    subject: subj,
    text: text
  };
  this.lastMetric = data.metric;
  debug('sending email with opts: %j', opts);
  this.transporter.sendMail(opts, function(err, result) {
    if (err) {
      self.emit('error', err);
      debug('failed to send email: %s', err);
      return;
    }
    debug('email sent successfully: %j', result)
  });
};

function subject(data) {
  return util.format('Service is at %s from %s', data.metric, data.host);
}

function body(data) {
  return JSON.stringify(data, null, 2);
}
