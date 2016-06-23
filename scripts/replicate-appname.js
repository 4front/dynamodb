var log = require('winston');
var AWS = require('aws-sdk');
var async = require('async');

var masterDynamo = new AWS.DynamoDB({region: 'us-west-2'});
var replicaDynamo = new AWS.DynamoDB({region: 'eu-central-1'});

masterDynamo.scan({
  TableName: '4front_appName'
}, function(err, data) {
  if (err) {
    log.error(err.message);
    process.exit(1);
  }

  async.eachSeries(data.Items, function(item, cb) {
    log.info('replicating appName %s', item.name.S);
    replicaDynamo.putItem({
      TableName: '4front_appName',
      Item: item,
      ConditionExpression: '#name <> :name',
      ExpressionAttributeNames: {'#name': 'name'},
      ExpressionAttributeValues: {':name': item.name}
    }, function(_err) {
      if (!_err || _err.code === 'ConditionalCheckFailedException') return cb();
      cb(_err);
    });
  }, function(_err) {
    if (_err) {
      log.error(_err.message);
      process.exit(1);
    }

    log.info('DONE');
    process.exit();
  });
});
