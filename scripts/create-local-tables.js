// Script to drop and recreate all of the tables in a local dynamodb for unit tests.
// http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Tools.DynamoDBLocal.html

/* istanbul ignore next */
var _ = require('lodash'),
  util = require('util'),
  async = require('async'),
  vogels = require('vogels'),
  AWS = require('aws-sdk'),
  modelDefinitions = require('../lib/models');

// Connect to DynamoDB local
var dynamoDb = new AWS.DynamoDB({
  region: 'us-west-2',
  endpoint: 'http://localhost:8000',
  accessKeyId: '4front',
  secretAccessKey: '4front'
});

vogels.dynamoDriver(dynamoDb);

async.each(_.keys(modelDefinitions), function(type, cb) {
  var defn = modelDefinitions[type];

  console.log("Deleting and recreating table 4front_" + defn.tableName);
  dynamoDb.deleteTable({TableName: '4front_' + defn.tableName}, function(err, data) {
    if (err && /ResourceNotFoundException/.test(err.toString()) === false)
      return cb(err);

    var model = vogels.define(type, defn);
    model.createTable({}, function(err) {
      if (err) {
        if (/ResourceInUseException/.test(err.toString()) === true) {
          console.log("Table 4front_" + defn.tableName + " already exists");
          return cb(null);
        }
        else {
          console.log("ERROR");
          return cb(err);
        }
      }
      cb();
    });
  });
}, function(err) {
  if (err)
    return console.log("Error creating table: " + err);

  console.log("Done creating tables");
});
