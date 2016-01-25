var async = require('async');
var nullBlankValues = require('../null-blank-values');

require('simple-errors');

module.exports = function(DynamoDb) {
  // Set the value of an addOn setting.
  DynamoDb.prototype.setKeyMapValue = function(key, mapKey, mapValue, callback) {
    var self = this;

    async.series([
      // First ensure the row exists for the key
      function(cb) {
        var params = {
          ConditionExpression: '#key <> :key',
          ExpressionAttributeNames: {'#key': 'key'},
          ExpressionAttributeValues: {':key': key}
        };

        self.models.KeyValueMap.create({key: key}, params, function(err) {
          if (err && err.code !== 'ConditionalCheckFailedException') {
            return cb(err);
          }

          cb();
        });
      },
      function(cb) {
        // Recurse through the object and delete any fields with an empty string.
        var params = {
          UpdateExpression: 'SET #value.#key = :value',
          ExpressionAttributeNames: {'#value': 'value', '#key': mapKey},
          ExpressionAttributeValues: {':value': nullBlankValues(mapValue)}
        };

        self.models.KeyValueMap.update({key: key}, params, cb);
      }
    ], callback);
  };

  // Get the value of a addon setting key
  DynamoDb.prototype.getKeyMapValue = function(key, mapKey, callback) {
    var params = {
      ProjectionExpression: '#value.#key',
      ExpressionAttributeNames: {'#value': 'value', '#key': mapKey}
    };

    this.models.KeyValueMap.get({key: key}, params, function(err, data) {
      if (err) return callback(err);

      if (!data) return callback(null, null);

      var keyValue = data.get('value');
      if (!keyValue) return callback(null, null);

      callback(null, keyValue[mapKey]);
    });
  };

  DynamoDb.prototype.deleteKeyMap = function(key, callback) {
    this.models.KeyValueMap.destroy({key: key}, callback);
  };

  DynamoDb.prototype.deleteKeyMapKey = function(key, mapKey, callback) {
    var params = {
      UpdateExpression: 'REMOVE #value.#key',
      ExpressionAttributeNames: {'#value': 'value', '#key': mapKey}
    };

    this.models.KeyValueMap.update({key: key}, params, callback);
  };
};
