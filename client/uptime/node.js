'use strict';
var os = require('os');
var uptimeInSeconds = os.uptime();
var uptime = Date.now() - (uptimeInSeconds * 1000);

module.exports = uptime;
