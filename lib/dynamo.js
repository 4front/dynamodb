var AWS = require('aws-sdk');
var vogels = require('vogels');
var _ = require('lodash');
var modelDefinitions = require('./models');

function DynamoDb(options) {
  options = _.defaults({}, options, {
    tablePrefix: null,
    modelExtensions: {}
  });

  this.crypto = options.crypto;
  this.options = options;
  this.metrics = options.metrics;

  // Set the vogels dynamo driver
  this._dynamodb = new AWS.DynamoDB(options);
  // vogels.dynamoDriver(this._dynamodb);

  var self = this;
  this.models = {};

  var modelPrefix = options.region || Date.now().toString();

  _.each(modelDefinitions, function(defn, type) {
    var modelDefinition = _.clone(defn);

    // Check if extended model attributes were provided. If so merge
    // them on top of the base model definition.
    var extensions = options.modelExtensions[type];
    if (extensions) {
      _.merge(modelDefinition, options.modelExtensions[type]);
    }

    // If a tablePrefix was provided, tack it on now.
    if (options.tablePrefix) {
      modelDefinition.tableName = options.tablePrefix + defn.tableName;
    }

    // Add a prefix to the vogels model name to avoid overwriting in the
    // shared vogels.models object. Since the dynamodb object is stored on
    // the Table (which is linked to the Model), we need to ensure
    // there is a distinct Model of each type, i.e. Application, Version, etc.
    // for each region specific DynamoDb instance.
    var model = vogels.define(modelPrefix + type, modelDefinition);
    model.config({dynamodb: self._dynamodb});
    self.models[type] = model;
  });
}

DynamoDb.prototype.incrementRead = function() {
  if (this.options.metrics) {
    this.options.metrics.increment('dynamodb-read');
  }
};

DynamoDb.prototype._stringifyJsonFields = function(fields, obj) {
  _.each(fields, function(field) {
    if (_.has(obj, field)) {
      obj[field] = JSON.stringify(obj[field]);
    }
  });
};

DynamoDb.prototype._parseJsonFields = function(fields, obj) {
  _.each(fields, function(field) {
    if (_.has(obj, field)) {
      obj[field] = JSON.parse(obj[field]);
    }
  });
};

DynamoDb.prototype._listCallback = function(callback) {
  return function(err, data) {
    if (err) return callback(err);

    callback(null, _.map(data.Items, 'attrs'));
  };
};

// Wrapper callback for the standard treatment for returning
// a single vogels item.
DynamoDb.prototype._itemCallback = function(callback) {
  return function(err, object) {
    if (err) return callback(err);

    if (!object) return callback(null, null);

    if (_.isArray(object.Items) && object.Items.length > 0) {
      callback(null, object.Items[0].attrs);
    } else {
      callback(null, object.attrs);
    }
  };
};

// Helper to create a conditional update expression
DynamoDb.prototype._orgIdCondition = function(orgId) {
  return {
    ConditionExpression: '#orgId = :orgId',
    ExpressionAttributeNames: {'#orgId': 'orgId'},
    ExpressionAttributeValues: {':orgId': orgId}
  };
};

DynamoDb.prototype._appIdCondition = function(appId) {
  return {
    ConditionExpression: '#appId = :appId',
    ExpressionAttributeNames: {'#appId': 'appId'},
    ExpressionAttributeValues: {':appId': appId}
  };
};

// In order to keep this file from getting huge, break out the definition
// of operations to different modules of related operations.
require('./operations/user')(DynamoDb);
require('./operations/application')(DynamoDb);
require('./operations/environment')(DynamoDb);
require('./operations/organization')(DynamoDb);
require('./operations/version')(DynamoDb);
require('./operations/env')(DynamoDb);
require('./operations/domain')(DynamoDb);
require('./operations/key-value')(DynamoDb);

module.exports = DynamoDb;
