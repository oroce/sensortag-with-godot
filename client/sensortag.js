var producer = require('godot-producer');
var noble = require('noble');
var series = require('run-series');
var async = require('async');
var once = require('once');
var devices = require('./devices');
var first = require('ee-first');

var format = require('util').format;
noble.on('stateChange', function(state) {
  console.log('state change', state);
  if (state === 'poweredOn') {
    noble.startScanning();
  } else {
    noble.stopScanning();
  }
});


var queue = async.queue(function process(device, _cb) {
  var cb = once(function(err) {
    device.removeListener('disconnect', onDisco);
    clearTimeout(timeout);
    _cb(err);
  });

  var timeout = setTimeout(onTimeout, queue.timeout);

  device.on('disconnect', onDisco);

  device.initialize(function(err) {
    console.log('device inited');
    cb(err);
  });


  function onTimeout() {
    console.log('timeout');
    device.disconnect();
  }
  function onDisco() {
    console.log('disco');
    cb();
  }
}, 1);
queue.timeout = 2 * 60 * 1000;
queue.drain = function drain() {
  console.log('drain saturated');
  noble.startScanning();
};
queue.saturated = function saturated() {
  console.log('queue saturated');
  noble.stopScanning();
};

module.exports = producer(function ctor() {
  var self = this;
  var allowed = process.env.UUIDS ? process.env.UUIDS.split(',') : [];
  this.devices = [];
  noble.on('discover', function(peripheral) {
    if (allowed.length !== 0 && allowed.indexOf(peripheral.uuid) === -1) {
      console.log('Ignoring %s because not in allowed (%s-%s)', peripheral.uuid, allowed.join('|'), allowed.length)
      return;
    }
    
    console.log('discoverd device at %s', new Date(), peripheral.uuid, peripheral.advertisement);
    var alreadyConnected = self.devices.some(function(device) {
      console.log('cpr %s - %s', device.uuid, peripheral.uuid);
      return device.uuid === peripheral.uuid;
    });
    if (alreadyConnected === true) {
      console.log('device %s (%s) already connected', peripheral.advertisement.localName, peripheral.uuid);
      return;
    }

    var advertisement = peripheral.advertisement;
    var localName = advertisement.localName;
    var txPowerLevel = advertisement.txPowerLevel;
    console.log('new device %s (adv=%s)', localName, JSON.stringify(advertisement));
    var device = devices(peripheral);
    if (device == null) {
      console.log('could not recognize device %s with address of %s', localName, peripheral.address);
      return;
    }
    noble.stopScanning();

    device.once('disconnect', function() {
      console.log('disco');
      var ndx = self.devices.indexOf(device)
      if (ndx === -1) {
        // it can happen, if tag disconnects before we could setup (low rssi)
        console.log('disco not setup device');
        self.emit('data', {
          service: 'state/intercepted',
          host: peripheral.uuid,
          meta: {
            uuid: peripheral.uuid,
            tx: txPowerLevel,
            rssi: peripheral.rssi
          },
          tags: ['st-connection']
        });
        return;
      }
      self.devices.splice(ndx, 1);
      self.emit('data', {
        service: 'state/disconnected',
        host: peripheral.uuid,
        meta: {
          uuid: peripheral.uuid,
          tx: txPowerLevel,
          rssi: peripheral.rssi
        },
        tags: ['st-connection']
      });
    });

    queue.push(device, function(err) {
      if (err) {
        self.emit('data', {
          service: 'state/failure',
          host: peripheral.uuid,
          meta: {
            message: err.message,
            tx: txPowerLevel,
            rssi: peripheral.rssi
          },
          tags: ['st-failure']
        });
        return
      }
      console.log('added %s', device);
      self.devices.push(device);
      self.emit('data', {
        service: 'state/connected',
        host: peripheral.uuid,
        meta: {
          uuid: peripheral.uuid,
          tx: txPowerLevel,
          rssi: peripheral.rssi
        },
        tags: ['st-connection']
      });
    });
  });


}, function produce() {
  var self = this;
  var len = this.devices.length;
  if (len === 0) {
    return console.log('no device yet');
  }
  var submit = function(err, results, device) {
    if (err) {
      console.log('error: %s', err, err, results);
      self.emit('error', err);
      return;
    }
    console.log('RESULTS', results);
    var rssi = results.rssi;
    var battery = results.battery;
    if (results.temp) {
      var temp = results.temp
      self.emit('data', {
        host: device.uuid,
        service: 'temperature/ambient',
        meta: {
          uuid: device.uuid,
          rssi: rssi,
          battery: battery
        },
        tags: ['st-metric'],
        metric: temp.ambient
      });
    }

    if (results.humidity) {
      var humidity = results.humidity;
      self.emit('data', {
        host: device.uuid,
        service: 'humidity/humidity',
        meta: {
          uuid: device.uuid,
          rssi: rssi,
          battery: battery
        },
        tags: ['st-metric'],
        metric: humidity.humidity
      });
    }

    self.emit('data', {
      host: device.uuid,
      service: 'rssi',
      meta: {
        uuid: device.uuid,
        rssi: rssi,
        battery: battery
      },
      tags: ['st-technical'],
      metric: rssi
    });

    if (battery) {
      self.emit('data', {
        host: device.uuid,
        service: 'battery',
        meta: {
          uuid: device.uuid,
          rssi: rssi,
          battery: battery
        },
        tags: ['st-technical'],
        metric: battery
      });
    }
  };
  
  var fns = this.devices.map(function(device) {
    return function(cb) {
      device.measure(function(err, result) {
        if (!result.rssi) {
          result.rssi = device._peripheral.rssi;
        }
        submit(err, result, device);
        cb();
      });
    }
  });
  console.log('starting measure');
  series(fns);
});

