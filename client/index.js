var godot = require('godot');
var sensortag = require('godot-sensortag');
var temperature = require('./temperature');
var memory = require('memory-producer');
var port = process.env.GODOT_PORT||1337;
var host = process.env.GODOT_SERVER||'localhost';
var os = require('os');
var logger = require('logify')();

if (process.env.LOGSTASH_HOST) {
  logger.add(require('logify-logstash-transport'), {
    host: process.env.LOGSTASH_HOST,
    port: process.env.LOGSTASH_PORT,
    transport: process.env.LOGSTASH_TRANSPORT || 'tcp'
  });
}

godot.createClient({
  producers: [
    godot.producer({
      host: os.hostname(),
      service: 'health/heartbeat',
      ttl: 1000 * 15
    }),
    sensortag({
      ttl: +process.env.TTL || 1000 * 15,
      mappings: {
        'bc6a29ac9ad0': 'st2',
        '1cba8c20e2c8': 'st1'
      },
      tistOptions: {
        watch: false,
        sensors: ['irTemperature', 'humidity']
      }
    }),
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
.on('reactor:error', function(err) {
  logger.error(err, 'Reactor error: %s at %s', err, new Date());
})
.on('error', function(err) {
  logger.error(err, 'Godot error %s at %s', err, new Date());
})
.connect(port, host, function(err) {
  if (err) {
    logger.error(err, 'Failed to connect: %s at %s', err, new Date());
  }
  logger.info('Connected to %s:%s at %s', host, port, new Date());
});

process.on('uncaughtException', function(err) {
  logger.error(err, 'Uncaught exception: %s at %s', err, new Date());
  process.nextTick(function() {
    process.exit(1);
  });
});