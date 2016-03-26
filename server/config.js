'use strict';
var boolean = require('boolean');
require('dotenv').load({path: __dirname + '/.env'});
var env = process.env.NODE_ENV || 'development';
module.exports = {
  email: {
    enabled: boolean(process.env.EMAIL_ENABLED) || env === 'production',
    auth: {
      user: process.env.MANDRILL_USER,
      pass: process.env.MANDRILL_KEY
    },
    host: 'smtp.mandrillapp.com',
    port: 587,
    to: process.env.EMAIL_TO,
    from: process.env.EMAIL_FROM,
  },
  throttle: {
    enabled: boolean(process.env.THROTTLING_REACTOR) || env === 'production',
  },
  expire: {
    enabled: boolean(process.env.EXPIRE_REACTOR) || env === 'production'
  },
  uptime: {
    enabled: boolean(process.env.UPTIME_REACTOR) || env === 'production'
  },
  influxdb: {
    enabled: boolean(process.env.INFLUXDB_REACTOR) || env === 'production',
    host: process.env.INFLUXDB_HOST || 'localhost',
    port: process.env.INFLUXDB_PORT || 8086,
    user: process.env.INFLUXDB_USER || '',
    password: process.env.INFLUXDB_PASSWORD || '',
    database: process.env.INFLUXDB_DB || 'test'
  },
  downtime: {
    enabled: process.env.DOWNTIME_REACTOR || env === 'production',
    expire: process.env.DOWNTIME_TTL || 60 * 60 * 1000 /*1d*/
  }
};
