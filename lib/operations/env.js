var async = require('async');
var _ = require('lodash');
var debug = require('debug')('4front:dynamodb:env');

require('simple-errors');

module.exports = function(DynamoDb) {
  DynamoDb.prototype.setEnvironmentVariable = function(options, callback) {
    var self = this;

    var params = {
      UpdateExpression: 'SET #attr.#environment=:empty',
      ConditionExpression: 'attribute_not_exists(#attr.#environment)',
      ExpressionAttributeNames: {'#attr': 'env', '#environment': options.virtualEnv},
      ExpressionAttributeValues: {':empty': {}}
    };

    // Need to set the environment variable in two seperate updates. The first one ensures
    // that the environment key exists in the map. The second to actually set the value
    // of the key.
    this.models.Application.update({appId:options.appId}, params, function(err) {
      if (err && err.code !== 'ConditionalCheckFailedException')
        return callback(err);

      var value = {
        value: options.value,
      };

      // Encrypt the value
      if (options.encrypt === true) {
        value = {
          value: self.crypto.encrypt(options.value),
          encrypted: true
        };
      }
      else {
        value = {value: options.value};
      }

      params = {
        UpdateExpression: 'SET #attr.#environment.#key=:value',
        ExpressionAttributeNames: {'#attr': 'env', '#key': options.key, '#environment': options.virtualEnv},
        ExpressionAttributeValues: {':value': value}
      };

      // First try and create the environment key in the env map if it doesn't exist.
      self.models.Application.update({appId:options.appId}, params, self._itemCallback(callback));
    });
  };

  DynamoDb.prototype.deleteEnvironmentVariable = function(appId, env, key, callback) {
    var self = this;

    var params = {
      UpdateExpression: 'REMOVE #attr.#environment.#key',
      ExpressionAttributeNames: {'#attr': 'env', '#key': key, '#environment': env}
    };

    this.models.Application.update({appId: appId}, params, function(err, data) {
      // Ignore ValidationExceptions since they indicate that the path to the env variable
      // did not exist.
      if (err && err.code !== 'ValidationException')
        return callback(err);

      self._itemCallback(callback)(null, data);
    });
  };
};
