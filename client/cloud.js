var request = require('request');
function auth(options, cb) {
  request({
    url: 'https://apiflowerpower.parrot.com/user/v1/authenticate',
    qs: {
      grant_type: 'password',
      client_id: options.clientId,
      client_secret: options.clientSecret,
      username: options.username,
      password: options.password
    },
    json: true
  }, function(err, response, json) {
    if (err) {
      return cb(err);
    }
    cb(null, json.access_token);
  });
}

module.exports.auth = auth;

function get(options, cb) {
  request({
    url: 'https://apiflowerpower.parrot.com/sensor_data/v2/sample/location/' + options.location,
    headers: {
      'Authorization': 'Bearer ' + options.token
    },
    qs: {
      from_datetime_utc: options.from,
      to_datetime_utc: options.to,
    },
    json: true
  }, function(err, resp, json) {
    if (err) {
      return cb(err);
    }

    cb(null, json);
  });
}
module.exports.get = get;

function garden(options, cb) {
  request({
    url: 'https://apiflowerpower.parrot.com/sensor_data/v3/sync',
    headers: {
      'Authorization': 'Bearer ' + options.token
    },
    qs: {
      include_s3_urls: 1
    },
    json: true
  }, function(err, resp, json) {
    if (err) {
      return cb(err);
    }

    cb(null, json);
  });
}

module.exports.garden = garden;

function upload(options, cb) {
  options.date = options.date || new Date();
  var offset = (new Date()).getTimezoneOffset();
  request({
    method: 'PUT',
    url: 'https://apiflowerpower.parrot.com/sensor_data/v5/sample',
    headers: {
      'Authorization': 'Bearer ' + options.token
    },
    body: {
      'client_datetime_utc': options.date,
      'user_config_version': options.userConfigVersion,
      'tmz_offset': offset,
      'session_histories': [{
         'sensor_serial' : options.serial,
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
         'sensor_fw_version': '',
         'sensor_hw_identifier' : '',
      }]
    },
    json: true
  }, function(err, resp, body) {
    console.log(err, body);
    cb(err, body);
  });
}

module.exports.upload = upload;
