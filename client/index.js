var godot = require('godot');
var sensortag = require('godot-sensortag');
godot.createClient({
  producers: [
    sensortag({
      mappings: {
        'd6cd418cedf34c268062a0414019f285': 'test-sensortag'
      }
    })
  ]
}).connect(1337);