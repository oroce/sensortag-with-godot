var producer = require('godot-producer');
var vcgencmd;
try{
  vcgencmd = require('vcgencmd');
} catch(x){
  // probably process.arch !== 'arch'
}

module.exports = producer(
  function ctor() {

  },
  function write() {
    var temp;
    if (!vcgencmd) {
      return;
    }
    try{
      temp = vcgencmd.measureTemp();
      this.emit('data', {
        metric: temp
      });
    } catch(x){
      this.emit('reactor:error', x);
    }
  }
);