var emailFactory = require('../factories/email');
module.exports = function(options) {
  return emailFactory(options, subject, body);
}

function subject(data) {
  return data.hostname + ' rebooted at ' + new Date(data.metric);
}

function body(data, prevMetric) {
  var duration = new Date(data.metric) - prevMetric;
  var text = [
    'Rebooted at: ' + new Date(data.metric) + '(' + data.metric + ')',
    'Last metric: ' + new Date(prevMetric) + '(' + prevMetric + ')',
    'Duration: ' + humanizeDuration(duration) + '(' + duration + ')'
  ];
  return [
    text.join('\n'),
    data.description,
    JSON.stringify(data, null, 2)
  ].join('\n\n');

}
