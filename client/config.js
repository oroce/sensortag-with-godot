'use strict';

require('dotenv').load();

var ttl = +process.env.TTL || 1000 * 15;
var uuids = {
  sensortag: deviceUuids('sensortag'),
  minew: deviceUuids('minew'),
  flowerPower: deviceUuids('flower_power')
};
var enabled = {
  sensortag: deviceEnabled('sensortag'),
  minew: deviceEnabled('minew'),
  flowerPower: deviceEnabled('flower_power')
};

module.exports = {
  rpi: process.env.RPI,
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
    location: process.env.FLOWER_POWER_CLOUD_LOCATION
  },
  flowerPower: {
    ttl: +process.env.FLOWER_POWER_TTL || ttl,
    enabled: uuids.flowerPower.length || enabled.flowerPower,
    uuids: uuids.flowerPower
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
