var log = require('winston');
var AWS = require('aws-sdk');
var async = require('async');

var masterDynamo = new AWS.DynamoDB({region: 'us-west-2'});
var replicaDynamo = new AWS.DynamoDB({region: 'eu-central-1'});

masterDynamo.scan({
  TableName: '4front_versions',
  FilterExpression: '#created >= :created',
  ExpressionAttributeNames: {'#created': 'created'},
  ExpressionAttributeValues: {':created': {S: '2016-03-01'}}
}, function(err, data) {
  if (err) {
    log.error(err.message);
    process.exit(1);
  }

  async.eachSeries(data.Items, function(item, cb) {
    log.info('replicating appId=%s, versionId=%s', item.appId.S, item.versionId.S);
    replicaDynamo.putItem({
      TableName: '4front_versions',
      Item: item,
      ConditionExpression: '#versionId <> :versionId',
      ExpressionAttributeNames: {'#versionId': 'versionId'},
      ExpressionAttributeValues: {':versionId': item.versionId}
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
