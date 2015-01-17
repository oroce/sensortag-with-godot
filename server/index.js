var godot = require('godot');
var influx = require('godot-influxdb');
var nma = require('../lib/notify-my-android');
function debug(socket, prefix) {
  return socket.pipe(godot.console(function(d){
    console.log(prefix, JSON.stringify(d));
  }));
}
function store(socket) {
  if (process.env.INFLUX_HOST) {
    return socket.pipe(influx({
      host: process.env.INFLUX_HOST||'localhost',
      port: 8086,
      user: '',
      password: '',
      database: 'test'
    }));
  }
  return socket;
}
function notify(socket) {
  if (process.env.SENDGRID_AUTH) {
    console.log('sendgridding');
    socket.pipe(godot.email({
      auth: {
        user: 'oroce',
        key: process.env.SENDGRID_AUTH
      },
      from: 'godot@oroszi.net',
      to: 'robert+sensortag@oroszi.net'
    }));
  }

  if (process.env.NMA_KEY) {
    console.log('NMAIng');
    return socket
      //.pipe(godot.change('state'))
      .pipe(nma({
        key: process.env.NMA_KEY
      }));
  }
  //return lastOne;
}
var server = godot.createServer({
  type: 'udp',
  reactors: [

    function heartbeat(socket) {
      var where = socket
        .pipe(godot.where('service', 'health/heartbeat'));
      debug(where, '[heartbeat arrived]');

      var expire = where
        .pipe(godot.expire(1000*60))
        .pipe(godot.map(function(data) {
          data.state = 'expired';
          return data;
        }));

      debug(expire, '[heartbeat expired]');
      notify(expire);
      return expire;
    },
    function diag(socket) {
      var where = socket
        .pipe(godot.where('service', 'rpi/memory/*'));

      debug(where, '[diagnosis]');
      store(where);
      return where;
    },
    function temperature(socket) {
      var where = socket
        .pipe(godot.where('service', 'temperature/*'));

      debug(where, '[temperature]');
      store(where);
      return where;
    },
    function humidity(socket) {
      var where = socket
        .pipe(godot.where('service', 'humidity/*'));

      debug(where, '[humidity]');
      store(where);
      return where;
    }
  ]
}).listen(1337);