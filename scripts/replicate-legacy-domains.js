var log = require('winston');
var AWS = require('aws-sdk');
var async = require('async');

var masterDynamo = new AWS.DynamoDB({region: 'us-west-2'});
var replicaDynamo = new AWS.DynamoDB({region: 'eu-central-1'});

masterDynamo.scan({
  TableName: '4front_domains'
}, function(err, data) {
  if (err) {
    log.error(err.message);
    process.exit(1);
  }

  async.eachSeries(data.Items, function(item, cb) {
    log.info('replicating legacy domain %s', item.domain.S);
    replicaDynamo.putItem({TableName: '4front_domains', Item: item}, cb);
  }, function(_err) {
    if (_err) {
      log.error(_err.message);
      process.exit(1);
    }

    log.info('DONE');
    process.exit();
  });
});
