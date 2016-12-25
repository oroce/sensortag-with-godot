var email = require('./rebot-email');
module.exports = function(config) {
  var reboot;
  if (config.email.enabled) {
    reboot = email(config.email);
  } else {
    reboot = godot.console();
  }

  var change = godot.change('metric');
  reboot.lastMetric = change.last = 0;

  return function(socket) {
    return socket
      .pipe(godot.where('service', '*/uptime'))
      .pipe(change)
      .pipe(reboot);
  }
};
