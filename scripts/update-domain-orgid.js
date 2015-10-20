/* eslint no-console: 0 */

var AWS = require('aws-sdk');
var async = require('async');
var _ = require('lodash');

// Connect to DynamoDB local
var dynamoDb = new AWS.DynamoDB({region: 'us-west-2'});


async.waterfall([
  function(cb) {
    listDomains(cb);
  },
  function(domains, cb) {
    async.eachSeries(domains, updateDomain, cb);
  }
], function(err) {
  if (err) {
    console.error(err);
  } else {
    console.log('done');
  }
});

function updateDomain(domain, callback) {
  async.waterfall([
    function(cb) {
      // Get the orgId of the app the domain is associated with.
      dynamoDb.getItem({
        Key: {
          appId: {
            S: domain.appId
          }
        },
        TableName: '4front_applications',
        AttributesToGet: ['orgId']
      }, cb);
    }, function(appData, cb) {
      var orgId = appData.Item.orgId.S;
      console.log('update domain %s orgId to %s', domain.domain, orgId);

      dynamoDb.updateItem({
        TableName: '4front_domains',
        Key: {
          domain: { S: domain.domain }
        },
        AttributeUpdates: {
          orgId: {
            Action: 'PUT',
            Value: {S: orgId}
          }
        }
      }, cb);
    }
  ], callback);
}

// Enumerate over all the rows in the domain table.
function listDomains(callback) {
  dynamoDb.scan({
    TableName: '4front_domains',
    AttributesToGet: ['domain', 'appId'],
  }, function(err, data) {
    callback(null, _.map(data.Items, function(item) {
      return {
        domain: item.domain.S,
        appId: item.appId.S
      };
    }));
  });
}
