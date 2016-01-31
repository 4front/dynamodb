/* eslint no-console: 0 */
// Script to drop and recreate all of the tables in a local dynamodb for unit tests.
// http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Tools.DynamoDBLocal.html

/* istanbul ignore next */
var _ = require('lodash'),
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

// var dynamoDb = new AWS.DynamoDB({
//   region: 'us-west-2'
// });

vogels.dynamoDriver(dynamoDb);

var models = _.keys(modelDefinitions);
// var models = ['Domain'];

async.eachSeries(models, function(type, cb) {
  var defn = modelDefinitions[type];

  setTimeout(function() {
    console.log('Deleting and recreating table 4front_' + defn.tableName);
    dynamoDb.deleteTable({TableName: '4front_' + defn.tableName}, function(err) {
      if (err && /ResourceNotFoundException/.test(err.toString()) === false) {
        return cb(err);
      }

      var model = vogels.define(type, _.extend({}, defn, {tableName: '4front_' + defn.tableName}));
      model.createTable({}, function(_err) {
        if (_err) {
          if (/ResourceInUseException/.test(_err.toString()) === true) {
            console.log('Table 4front_' + defn.tableName + ' recreated');
            return cb(null);
          }
          console.log('ERROR');
          return cb(_err);
        }
        console.log('Table 4front_' + defn.tableName + ' created from scratch');
        cb();
      });
    });
  }, 5000);
}, function(err) {
  if (err) return console.log('Error creating table: ' + err);

  console.log('Done creating tables');
});
