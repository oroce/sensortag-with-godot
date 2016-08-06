'use strict';

require('dotenv').load({path: __dirname + '/.env'});
var env = process.env.NODE_ENV || 'development';
module.exports = {
  email: {
    enabled: process.env.EMAIL_ENABLED || env === 'production',
    auth: {
      user: process.env.MANDRILL_USER || process.env.EMAIL_USER,
      pass: process.env.MANDRILL_KEY || process.env.EMAIL_PASSWORD
    },
    host: process.env.EMAIL_HOST,
    port: 587,
    to: process.env.EMAIL_TO,
    from: process.env.EMAIL_FROM,
  },
  throttle: {
    enabled: process.env.THROTTLING_REACTOR || env === 'production',
  },
  expire: {
    enabled: process.env.EXPIRE_REACTOR || env === 'production'
  },
  uptime: {
    enabled: process.env.UPTIME_REACTOR || env === 'production'
  },
  influxdb: {
    enabled: process.env.INFLUXDB_REACTOR || env === 'production',
    host: process.env.INFLUXDB_HOST || 'localhost',
    port: process.env.INFLUXDB_PORT || 8086,
    user: process.env.INFLUXDB_USER || '',
    password: process.env.INFLUXDB_PASSWORD || '',
    database: process.env.INFLUXDB_DB || 'test'
  },
  forward: {
    enabled: process.env.FORWARD_ENABLED,
    host: process.env.FORWARD_HOST,
    port: +process.env.FORWARD_PORT,
    type: process.env.FORWARD_TYPE
  }
};
