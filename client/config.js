'use strict';

var path = require('path');
require('dotenv').load({path: path.join(__dirname, '.env')});
var ttl = +process.env.TTL || 1000 * 15;
var uuids = {
  sensortag: deviceUuids('sensortag'),
  minew: deviceUuids('minew'),
  flowerPower: deviceUuids('flower_power'),
  flowerPowerHistory: deviceUuids('flower_power_history')
};
var enabled = {
  sensortag: deviceEnabled('sensortag'),
  minew: deviceEnabled('minew'),
  flowerPower: deviceEnabled('flower_power'),
  flowerPowerCloud: deviceEnabled('flower_power_cloud'),
  flowerPowerHistory: deviceEnabled('flower_power_history'),
  uptime: deviceEnabled('uptime')
};

module.exports = {
  lead: process.env.LEAD,
  rpi: process.env.RPI,
  dummy: process.env.DUMMY,
  sensortag: {
    ttl: +process.env.SENSORTAG_TTL || ttl,
    enabled: uuids.sensortag.length || enabled.sensortag,
    uuids: uuids.sensortag
  },
  minew: {
    ttl: +process.env.MINEW_TTL || ttl,
    enabled: uuids.minew.length || enabled.minew,
    uuids: uuids.minew
  },
  flowerPowerCloud: {
    ttl: +process.env.FLOWER_POWER_CLOUD_TTL || ttl,
    clientId: process.env.FLOWER_POWER_CLOUD_CLIENT_ID,
    clientSecret: process.env.FLOWER_POWER_CLOUD_CLIENT_SECRET,
    username: process.env.FLOWER_POWER_CLOUD_USERNAME,
    password: process.env.FLOWER_POWER_CLOUD_PASSWORD,
    location: split(process.env.FLOWER_POWER_CLOUD_LOCATION),
    enabled: enabled.flowerPowerCloud
  },
  flowerPower: {
    ttl: +process.env.FLOWER_POWER_TTL || ttl,
    enabled: uuids.flowerPower.length || enabled.flowerPower,
    uuids: uuids.flowerPower
  },
  flowerPowerHistory: {
    ttl: +process.env.FLOWER_POWER_HISTORY_TTL || ttl,
    enabled: uuids.flowerPowerHistory.length || enabled.flowerPowerHistory,
    uuids: uuids.flowerPowerHistory,
    clientId: process.env.FLOWER_POWER_CLOUD_CLIENT_ID,
    clientSecret: process.env.FLOWER_POWER_CLOUD_CLIENT_SECRET,
    username: process.env.FLOWER_POWER_CLOUD_USERNAME,
    password: process.env.FLOWER_POWER_CLOUD_PASSWORD,
    location: process.env.FLOWER_POWER_CLOUD_LOCATION
  },
  weather: {
    key: process.env.WEATHER_KEY,
    location: process.env.WEATHER_LOCATION,
    enabled: process.env.WEATHER_KEY && process.env.WEATHER_LOCATION,
    ttl: +process.env.WEATHER_TTL || ttl
  },
  uptime: {
    enabled: enabled.uptime,
    service: process.env.UPTIME_SERVICE,
    ttl: +process.env.UPTIME_TTL || ttl
  }
};

function deviceEnabled(name) {
  return process.env[name.toUpperCase() + '_ENABLED'] != null;
}

function deviceUuids(name) {
  return split(process.env[name.toUpperCase() + '_UUIDS']);
}

function split(value) {
  if (value == null) {
    return [];
  }
  return value.split(',')
    .filter(function(v) {
      return v !== '';
    });
}
