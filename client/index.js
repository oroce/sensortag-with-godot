var godot = require('godot');
var sensortag = require('godot-sensortag');
var temperature = require('./temperature');
var memory = require('memory-producer');
godot.createClient({
  producers: [
    sensortag({
      mappings: {
        'd6cd418cedf34c268062a0414019f285': 'st1',
        '1aeaf513aeb54763ba51a0a7769683c2': 'st2'
      },
      tistOptions: {
        sensors: ['irTemperature', 'humidity']
      }
    }),
    temperature(),
    memory({})
  ]
}).connect(1337);