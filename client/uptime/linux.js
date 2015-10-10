'use strict';
var execSync = require('child_process').execSync;
var epoch = execSync('date -d "$(who -b | awk \'{print $4,$3}\' | tr - / )" +%s');
module.exports = epoch * 1000;
