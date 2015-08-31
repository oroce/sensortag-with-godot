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
    console.log('auth resp', json, err)
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
