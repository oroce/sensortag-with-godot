var producer = require('godot-producer');
var noble = require('noble');
var series = require('run-series');
var SensorTag = require('sensortag');
var queue = require('queue')();
// 1 minute should be enough to connect
queue.timeout = 2 * 60 * 1000;
queue.concurrency = 1;
var CC2540SensorTag = SensorTag.CC2540;
SensorTag.SCAN_DUPLICATES = true;
CC2540SensorTag.SCAN_DUPLICATES = true;
var NobleDevice = require('sensortag/node_modules/noble-device');
NobleDevice.Util.mixin(CC2540SensorTag, NobleDevice.BatteryService);
var format = require('util').format;
noble.on('stateChange', function(state) {
  console.log('state change', state);
  if (state === 'poweredOn') {
    noble.startScanning();
  } else {
    noble.stopScanning();
  }
});
queue
  .on('timeout', function(next, job) {
    console.log('timeout', job);
    job.cancel(next);
    // should cancel `job`
    //next();
  })
  .on('error', function(err, job) {
    console.log('error occured=', err, '' + job);
  })
  .on('success', function(result, job) {
    console.log('successfully run job=', '' + job);
  })
  .on('end', function() {
    console.log('no more jobs to process, scanning');
    noble.startScanning();
  })
queue.start();
module.exports = producer(function ctor() {
  var self = this;
  var allowed = (process.env.UUIDS || '').split(',');
  this.devices = [];
  console.log('new instance');
  noble.on('discover', function(peripheral) {
    if (allowed.length && allowed.indexOf(peripheral.uuid) === -1) {
      console.log('Ignoring %s because not in allowed (%s)', peripheral.uuid, allowed)
      queue.start();
      return;
    }
    noble.stopScanning();
    console.log('discoverd device at %s', new Date(), peripheral.uuid, peripheral.advertisement);
    var advertisement = peripheral.advertisement;
    var localName = advertisement.localName; // || 'SensorTag';
    var txPowerLevel = advertisement.txPowerLevel;
    console.log('new device %s (adv=%s)', localName, JSON.stringify(advertisement));
    if ((localName === 'SensorTag') || (localName === 'TI BLE Sensor Tag')) {
      var job = function(cb) {
        var tag = new CC2540SensorTag(peripheral);
        tag.on('disconnect', function() {
          console.log('disco');
          var ndx = self.devices.indexOf(tag)
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
            queue.start();
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
          queue.start();
        });
        console.log('start connecting=', peripheral.uuid);
        series([
          function(cb) {
            tag.connect(cb);
          },
          function(cb) {
            tag.discoverServicesAndCharacteristics(cb);
          },
          function(cb) {
            tag.enableIrTemperature(cb);
          },
          function(cb) {
            tag.enableHumidity(cb);
          }
        ], function(err) {
          if (err) {
            self.emit('error', err);
            cb(err);
            return
          }
          console.log('added %s', tag);
          self.devices.push(tag);
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
          //noble.startScanning();
          cb(null, {
             uuid: peripheral
          });
       });
      };
      job.cancel = function(cb) {
        peripheral.disconnect(cb);
      };
      job.toString = function() {
        return localName + '(' + peripheral.uuid + ')';
      };
      queue.push(job);
      queue.start();
      console.log('job added to the queue');
    } else {
      console.log('dunno what is it', localName, peripheral);
    }
    
  });


}, function produce() {
  var self = this;
  var len = this.devices.length;
  if (len === 0) {
    return console.log('no device yet');
  }
  var read = function(device, fn) {
    series([
      function(cb) {
        device.readIrTemperature(function(err, object, ambient) {
          if (err) return cb(err);
          cb(null, {
            object: object,
            ambient: ambient
          });
        });
      },
      function(cb) {
        device.readHumidity(function(err, temperature, humidity) {
          if (err) return cb(err);
          cb(null, {
            temperature: temperature,
            humidity: humidity
          });
        });
      },
      function(cb) {
        if (device._peripheral.advertisement.serviceUuids.indexOf('180f') === -1) {
          return cb();
        }
        device.readBatteryLevel(cb);
      },
      function(cb) {
        device._peripheral.updateRssi(cb);
      }
    ], function(err, results) {
      if (err) {
        self.emit('error', err);
        fn(err);
        return;
      }
      var temp = results[0];
      var humidity = results[1];
      var battery = results[2]
      var rssi = results[3];

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
      fn();
    });
  };

  var fns = this.devices.map(function(device) {
    return function(fn) {
      read(device, fn);
    };
  });
  series(fns);
});

