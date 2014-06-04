var godot = require('godot');
var influx = require('godot-influxdb');
var server = godot.createServer({
  type: 'udp',
  reactors: [
    function (socket) {
      return socket
        .pipe(godot.console(function(d){
          console.log(JSON.stringify(d));
        }))
        .pipe(influx({
          host: 'localhost',
          port: 8086,
          user: '',
          password: '',
          database: 'test'
        }));
    }
  ]
}).listen(1337);