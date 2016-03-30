'use strict';
var config = require('./config');

var godot = require('godot');
//var sensortag = require('godot-sensortag');
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
var flowerPowerHistoryProducer = require('./flower-power-history');
var weatherProducer = require('./weather');
var uptimeProducer = require('./uptime');
var extend = require('deep-extend');
var noble = require('noble');
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
        producers.push(ctor(extend({}, config[type], {
          uuid: uuid,
        })));
      });
    } else if (Array.isArray(config[type].location) && (config[type].location || []).length) {
      config[type].location.forEach(function(location, i) {
        debug('adding %s. %s with location %s and ttl:%s',
          i,
          type,
          location,
          config[type].ttl);
        producers.push(ctor(extend({}, config[type], {
          location: location
        })));
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
add('flowerPowerHistory', flowerPowerHistoryProducer);
add('weather', weatherProducer);
add('uptime', uptimeProducer);
if (config.rpi) {
  producers.push(temperature({
    host: 'rpi',
    service: 'rpi/temperature'
  }));
}
if (config.dummy) {
  producers.push(Dummy({ttl: +config.dummy || 600}));
}
console.log('Producers.len=', producers.length)
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
client.connect(port, host, function(err) {
  if (err) {
    console.error(err);
  }
  console.log('Connected to %s:%s', host, port);
});

function produce() {
  producers.forEach(function(producer) {
    producer.produce();
  });
}
if (config.lead) {
  produce();
}

process.on('uncaughtException', function(err) {
  console.log('UNCAUGHT EXCEPTION: ' + err);
  console.error(err);
  process.exit(1);
});

const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const stringify = require('json-stringify-safe');
server.on('error', (err) => {
  console.log(`server error:\n${err.stack}`);
  server.close();
});

server.on('message', (msg, rinfo) => {
  console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
  switch (('' + msg).trim().toLowerCase()) {
    case 'dump':
      console.log(stringify(noble, null, 2));
      break;
    case 'produce':
      produce();
      break;
    case 'startscanning':
      noble.startScanning([], true);
      break;
    default:
      console.log(`Cannot handle "${msg}"`);
      break;
  }
});

server.on('listening', () => {
  var address = server.address();
  console.log(`server listening ${address.address}:${address.port}`);
});

server.bind();
