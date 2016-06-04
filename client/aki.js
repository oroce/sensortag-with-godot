// this is the hungarian price service
'use strict';
var producer = require('godot-producer');
var debug = require('debug')('swg:service:aki');
var request = require('request');
var XLSX = require('xlsx');
var DAY_HEADERS = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
var CUCUMBER_NORMAL_AVG_ROW = 90;
var CUCUMBER_SMALL_AVG_ROW = 87;
var DAY_HEADER_ROW = 2;
module.exports = producer(
  function ctor(options) {
    options = options || {};
    debug('aki ctor: %j', options);
    this.options = options;
    this.on('error', console.error.bind(console));
  },
  function produce() {
    var self = this;
    // var servicePrefix = this.options.service;
    // var service = (servicePrefix ? servicePrefix + '/' : '') + 'uptime';
    // debug('New uptime event for %s is %s', service, new Date(uptime));
    // this.emit('data', {
    //   service: service,
    //   metric: uptime,
    //   description: hostname + ' is rebooted ' + ago(uptime)
    // });

    /*
      1. get: https://pair.aki.gov.hu/web_public/general/showresults.do?id=5012342762&lang=hu
      2. parse html
      3. find the following items:
         form = document.querySelector('form')
         params = form.querySelector('input[type=hidden]')
          .reduce( (obj, elem) => {
            obj[elem.attr('name')] = elem.attr('value');
          }, {})
         button = form.querySelecto('table.TableTag input');
         params[button.attr('name')] = 'exists';
      4. post -d params.stringify https://pair.aki.gov.hu/web_public/general/showresults.do
      5. response['location'].replace 'showresults', 'docconverter'
          .querystring replace 'back=(.*)', type=6

    */
    var parser = require('fast-html-parser');
    request({
      url: 'https://pair.aki.gov.hu/web_public/general/showresults.do?id=5012342762&lang=hu',

    }, function(err, res, body) {
      if (err) {
        throw err;
      }
      var root = parser.parse(body);
      var form = root.querySelector('FORM');

      var params = form.querySelectorAll('INPUT')
        .filter(function(el) {
          return el.attributes.type === 'hidden';
        })
        .reduce(function(obj, el) {
          obj[el.attributes.name] = el.attributes.value;
          return obj;
        }, {});

      var button = form.querySelector('TABLE.TableTag INPUT');
      // the value is just dummy value
      // the original site contains an utf8 string
      // but I dont wanna mess that stuff
      // their backend seems obsolote that I may
      // break something
      params[button.attributes.name] = 'yes';

      console.log('params', params);
      var url = require('url');
      request({
        method: 'POST',
        url:  'https://pair.aki.gov.hu/web_public/general/showresults.do',
        form: params,
        followRedirect: false
      }, function(err, res,body) {
        if (err) {
          throw err;
        }
        var location = res.headers['location'];
        var parts = url.parse(location, true);
        parts.pathname = parts.pathname.replace('showresult', 'docconverter');
        delete parts.search;
        delete parts.query.back;
        parts.query.type = 6;
        console.log('parts', parts);
        var downloadUrl = url.format(parts);
        console.log('download', downloadUrl, parts);
        request({
          url: downloadUrl,
          encoding: null
        }, function(err, resp, body) {
          if (err) throw err;
          parse(body);
        });
        //console.log(err, res && res.headers, body);
      })
    });
    return;
    request({
      url: this.options.url,
      encoding: null,
    }, function(err, response, body) {
      if (err) {
        self.emit('error', err);
        return;
      }
      parse(body);
    });
    function parse(body) {
      var wb = XLSX.read(body);
      var sheetName = wb.SheetNames[0];
      var sheet = wb.Sheets[sheetName];

      DAY_HEADERS.map(function(column) {
        var dayCell = column + DAY_HEADER_ROW;
        var priceCell = column + CUCUMBER_NORMAL_AVG_ROW;
        var day = new Date(sheet[dayCell].v);
        day.setHours(12);
        var price = sheet[priceCell].v;
        if (!price || price === '-') {
          price = sheet[column + CUCUMBER_SMALL_AVG_ROW].v;
        }
        debug('getting %s and %s', day, price);
        return {
          day: day,
          price: price
        };
      }).filter(function(val) {
        return val.price && val.price !== '-';
      }).forEach(function(row) {
        var data = {
          service: 'aki/daily/cucumber',
          metric: row.price,
          description: 'cucumber price for ' + row.day.toJSON() + ' is ' + row.price + ' Ft',
          time: row.day.valueOf()
        };
        console.log('data', data);
        self.emit('data', data);
      });
    }
  }
);
