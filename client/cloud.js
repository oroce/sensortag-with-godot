var request = require('request');
var debug = require('debug')('swg:parrot-cloud');
function auth (options, cb) {
  request({
    url: 'https://api-flower-power-pot.parrot.com/user/v1/authenticate',
    qs: {
      grant_type: 'password',
      client_id: options.clientId,
      client_secret: options.clientSecret,
      username: options.username,
      password: options.password
    },
    json: true
  }, function (err, response, json) {
    if (err) {
      return cb(err);
    }
    debug('response (code=%s) received: %j', response.statusCode, json);
    cb(null, json.access_token);
  });
}

module.exports.auth = auth;

function get (options, cb) {
  request({
    url: 'https://api-flower-power-pot.parrot.com/sensor_data/v6/sample/location/' + options.location,
    headers: {
      'Authorization': 'Bearer ' + options.token
    },
    qs: {
      from_datetime_utc: options.from,
      to_datetime_utc: options.until
    },
    json: true
  }, function (err, resp, json) {
    if (err) {
      return cb(err);
    }

    cb(null, json);
  });
}
module.exports.get = get;

function garden (options, cb) {
  request({
    url: 'https://apiflowerpower.parrot.com/sensor_data/v3/sync',
    headers: {
      'Authorization': 'Bearer ' + options.token
    },
    qs: {
      include_s3_urls: 1
    },
    json: true
  }, function (err, resp, json) {
    if (err) {
      return cb(err);
    }

    cb(null, json);
  });
}

module.exports.garden = garden;

function upload (options, cb) {
  options.date = options.date || new Date();
  var offset = (new Date()).getTimezoneOffset();
  var url = 'https://api-flower-power-pot.parrot.com/sensor_data/v8/sample';
  var body = {
    'client_datetime_utc': options.date,
    'user_config_version': options.userConfigVersion,
    'tmz_offset': offset,
    'plant_science_database_identifier': 'en_20151020_3.0.2',
    'session_histories': [{
      'sensor_serial': options.serial,
      'session_id': options.currentId,
      'sample_measure_period': options.currentSessionPeriod,
      'sensor_startup_timestamp_utc': options.startupTime,
      'session_start_index': options.currentSessionStartIdx
    }],
    'uploads': [{
      'sensor_serial': options.serial,
      'upload_timestamp_utc': options.date,
      'buffer_base64': options.history,
      'app_version': '',
      'sensor_fw_version': options.firmwareVersion,
      'sensor_hw_identifier': options.hardwareVersion
    }]
  };
  debug('put to %s: %j (options=%j)', url, body, options);
  request({
    method: 'PUT',
    url: url,
    headers: {
      'Authorization': 'Bearer ' + options.token
    },
    body: body,
    json: true
  }, function (err, resp, body) {
    debug('received upload response, err=%s, body=', err, body);
    cb(err, body);
  });
}

module.exports.upload = upload;

function profile (options, cb) {
  request({
    url: 'https://api-flower-power-pot.parrot.com/user/v4/profile',
    headers: {
      'Authorization': 'Bearer ' + options.token
    },
    json: true
  }, function (err, resp, json) {
    if (err) {
      return cb(err);
    }
    debug('received profile info: %j', json);
    cb(null, json);
  });
}
module.exports.profile = profile;
