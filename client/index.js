var godot = require('godot');
var sensortag = require('godot-sensortag');
var temperature = require('./temperature');
var memory = require('memory-producer');
var port = process.env.GODOT_PORT||1337;
var host = process.env.GODOT_SERVER||'localhost';
godot.createClient({
  producers: [
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
    temperature({
      host: 'rpi',
      service: 'rpi/temperature'
    }),
    memory({
      host: 'rpi',
      service: 'rpi/memory'
    })
  ]
}).connect(port, host, function(err) {
  if (err) {
    console.error(err);
  }
  console.log('Connected to %s:%s', host, port);
});