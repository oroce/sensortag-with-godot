var producer = require('godot-producer');
var noble = require('noble');
var series = require('run-series');
var CC2540SensorTag  = require('sensortag').CC2540;
var format = require('util').format;
noble.on('stateChange', function(state) {
  console.log('state change', state);
  if (state === 'poweredOn') {
    noble.startScanning();
  } else {
    noble.stopScanning();
  }
});

module.exports = producer(function ctor() {
  var self = this;
  this.devices = [];
  console.log('new instance');
  noble.on('discover', function(peripheral) {
    noble.stopScanning();
    var localName = peripheral.advertisement.localName;
    console.log('new device %s', localName);
    if ((localName === 'SensorTag') || (localName === 'TI BLE Sensor Tag')) {
       var tag = new CC2540SensorTag(peripheral);
       tag.on('disconnect', function() {
          console.log('disco');
          var ndx = self.devices.indexOf(tag)
          if (ndx === -1) {
            // it can happen, if tag disconnects before we could setup (low rssi)
            console.log('disco not setup device');
            return;
          }
          self.devices.splice(ndx, 1);
       });

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
           this.emit('error', err);
           noble.startScanning();
           return
         }
         console.log('added %s', tag);
         self.devices.push(tag);
         noble.startScanning();
       });
       /*console.log('connecting');
       tag.connect(function(err) {
         if (err) {
           return console.error(err);
         }
         console.log('connected');
         tag.discoverServicesAndCharacteristics(function(err) {
           if (err) {
            return console.error(err);
           }
           console.log('discovered services');
           tag.enableIrTemperature(function(err) {
             if (err) {
               return console.error(err);
             }
             console.log('device added=', tag.uuid);
             self.devices.push(tag);
           });
         });
       });*/
       // ...
    }
  });


}, function produce() {
  var self = this;
  var len = this.devices.length;
  if (len === 0) {
    console.log('no device yet');
  }
  this.devices.forEach(function(device) {
    series([
      function(cb) {
        device.readIrTemperature(cb);
      },
      function(cb) {
        device.readHumidity(cb);
      },
      function(cb) {
        device._peripheral.updateRssi(cb);
      }
    ], function(err, results) {
      if (err) {
        self.emit('error', err);
        return;
      }

      var temp = results[0];
      var humidity = results[1];
      var rssi = results[2];

      self.emit('data', {
        host: device.uuid,
        service: format('godot.%s.temperature', device.uuid),
        meta: {
          uuid: device.uuid,
          rssi: rssi
        },
        tags: [],
        metric: temp
      });

      self.emit('data', {
        host: device.uuid,
        service: format('godot.%s.humidity', device.uuid),
        meta: {
          uuid: device.uuid,
          rssi: rssi
        },
        tags: [],
        metric: humidity
      });

      self.emit('data', {
        host: device.uuid,
        service: format('godot.%s.rssi', device.uuid),
        meta: {
          uuid: device.uuid,
          rssi: rssi
        },
        tags: [],
        metric: rssi
      })
    });
  })
});
