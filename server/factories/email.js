var email = require('../email');
module.exports = function emailFactory(config, subject, body) {
  return email({
    subject: subject,
    body: body,

    auth: config.auth,
    from: config.from,
    to: config.to,
    interval: 1,
    host: config.host,
    port: config.port,
  });
};
