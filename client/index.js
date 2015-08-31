'use strict';
var config = require('./config');
var godot = require('godot');
var async = require('async');
var retry = require('retry-me');
var debug = require('debug')('swg:client');
var temperature = require('./temperature');
var memory = require('memory-producer');
var port = process.env.GODOT_PORT||1337;
var host = process.env.GODOT_SERVER||'localhost';
var producer = require('godot-producer');
var sensortagProducer = require('./sensortag');
var minewProducer = require('./minew');
var flowerPowerProducer = require('./flower-power');
var flowerPowerCloudProducer = require('./flower-power-cloud');
var weatherProducer = require('./weather');
var Dummy = producer(function() {
  this.ndx = 0;
}, function() {
  ++this.ndx;
  this.emit('data', {
    tags: ['st-metric'],
    metric: this.ndx,
    service: 'dummy/producer'
  });
});

var producers = [];

function add(type, ctor) {
  if (config[type].enabled) {
    // flower power cloud
    if ((config[type].uuids || []).length) {
      config[type].uuids.forEach(function(uuid, i) {
        debug('adding %s. %s with uuid %s and ttl:%s',
          i,
          type,
          uuid,
          config[type].ttl);
        producers.push(ctor({
          uuid: uuid,
          ttl: config[type].ttl
        }));
      });
    } else {
      debug('adding an uuidless %s with opts: %j', type, config[type]);
      producers.push(ctor(config[type]));
    }
  }
}
add('sensortag', sensortagProducer);
add('minew', minewProducer);
add('flowerPower', flowerPowerProducer);
add('flowerPowerCloud', flowerPowerCloudProducer);
add('weather', weatherProducer);
if (config.rpi) {
  producers.push(temperature({
    host: 'rpi',
    service: 'rpi/temperature'
  }));
}
if (config.dummy) {
  producers.push(Dummy({ttl: +config.dummy || 600}));
}
var client = godot.createClient({
  type: 'tcp',
  reconnect: {
    retries: Infinity,
    maxDelay: 1000 * 10
  },
  producers: producers || [
    /*Dummy({
      ttl: 600
    }),*/
    /*sensortagProducer({
      ttl: config.sensortag.ttl,
    }),
    minewProducer({
      ttl: config.minew.ttl
    }),*/
    /*flowerPowerCloudProducer({
      ttl: config.flowerPowerCloud.ttl,
      clientId: config.flowerPowerCloud.clientId,
      clientSecret: config.flowerPowerCloud.clientSecret,
      username: config.flowerPowerCloud.username,
      password: config.flowerPowerCloud.password,
      location: config.flowerPowerCloud.location
    }),*/
    /*flowerPowerProducer({
      ttl: config.flowerPower.ttl
    })*/
    /*sensortag({
      ttl: +process.env.TTL || 1000 * 15,
      mappings: {
        'bc6a29ac9ad0': 'st2',
        '1cba8c20e2c8': 'st1'
      },
      tistOptions: {
        watch: false,
        sensors: ['irTemperature', 'humidity']
      }
    }),*/
    /*temperature({
      host: 'rpi',
      service: 'rpi/temperature'
    }),
    memory({
      host: 'rpi',
      service: 'rpi/memory'
    })*/
  ]
})
client
  .on('connect', function onconnect() {
    debug('connecting');
  })
  .on('error', function onerror(err) {
    debug('error occured: %s', err);
  })
  .on('reconnect', function onreconnect() {
    debug('trying to reconnect');
  });
client.msgQueue = async.queue(function(data, cb) {
  var tries = 0;
  debug('message has been started processed, len=%s', client.msgQueue.length());
  retry(function trySend(fn) {
    debug('Trying to send for %s, what=%j', ++tries, data);

    // reasons:
    // * this.socket gets redefined
    // * simple socket timeout
    // * some kind of woodoo magic
    var tick = setTimeout(function() {
      fn(new Error('timedout'));
    }, 5000);
    client._write(data, function(err, resp) {
      clearTimeout(tick);
      fn(err,resp);
    });
  }, {
    retries: 1e6,
    factor: 2,
    minTimeout: 10000,
    maxTimeout: 2000000,
    randomize: true
  }, function(err, data) {
    if (err) {
      debug('Failed to send for %s, reason=%s, what=%j', tries, err.toString(), data);
      return cb(err);
    }
    debug('Managed to send for %s', tries);
    cb();
  });
}, 1);

client._write = function _write(data, cb) {
  var message = !Array.isArray(data)
  ? JSON.stringify(data) + '\n'
  : data.map(JSON.stringify).join('\n') + '\n'
  if (this.type === 'tcp' || this.type === 'unix') {
    if (!this.socket) {
      return cb && cb(new Error('Socket isnt ready yet'));
    }
    this.socket.write(message, cb);
  }
  else if (this.type === 'udp') {
    message = new Buffer(message);
    this.socket && this.socket.send(message, 0, message.length, this.port, this.host);
    cb && cb();
  }
};
client.write = function(data) {
  //console.log('data', data);
  client.msgQueue.push(data);
};
client.connect(port, host, function(err) {
  if (err) {
    console.error(err);
  }
  console.log('Connected to %s:%s', host, port);
});

if (config.lead) {
  producers.forEach(function(producer) {
    producer.produce();
  });
}
process.on('uncaughtException', function(err) {
  console.error(err);
  process.exit(1);
});
