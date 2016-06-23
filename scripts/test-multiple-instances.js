var log = require('winston');
var async = require('async');
var DynamoDb = require('../lib/dynamo');

var dynamoDb1 = new DynamoDb({region: 'us-west-2', tablePrefix: '4front_'});
var dynamoDb2 = new DynamoDb({region: 'eu-central-1', tablePrefix: '4front_'});

var appId = '79d4d79d-6a93-419b-abe4-e6b45902dc48';

async.each([dynamoDb1, dynamoDb2], function(dynamo, cb) {
  dynamo.getApplication(appId, function(err, app) {
    log.info(dynamo.options.region + ': ' + JSON.stringify(app));
    cb();
  });
}, function() {
  log.info('done');
});
