var vogels = require('vogels');
var _ = require('lodash');
var camelCase = require('camel-case');
var modelDefinitions = require('./models');

function DynamoDb(options) {
	options = _.defaults(options, {
		tablePrefix: null,
		modelExtensions: {}
	});

	if (!options.cryptoPassword) {
		throw new Error("Missing option cryptoPassword");
	}

	this.cryptoPassword = options.cryptoPassword;

	// Set the vogels dynamo driver
	// vogels.dynamoDriver(dynamoDb);
	vogels.AWS.config.update(options);

	var self = this;
	this.models = {};

	_.each(modelDefinitions, function(defn, type) {
		// Check if extended model attributes were provided. If so merge
		// them on top of the base model definition.
		var extensions = options.modelExtensions[type];
		if (extensions)
			_.merge(defn, options.modelExtensions[type]);

		// If a tablePrefix was provided, tack it on now.
		if (options.tablePrefix)
			defn.tableName = options.tablePrefix + defn.tableName;

		self.models[type] = vogels.define(type, defn);
	});
}

DynamoDb.prototype._stringifyJsonFields = function(fields, obj) {
  _.each(fields, function(field) {
    if (_.has(obj, field))
      obj[field] = JSON.stringify(obj[field]);
  });
};

DynamoDb.prototype._parseJsonFields = function(fields, obj) {
  _.each(fields, function(field) {
    if (_.has(obj, field))
      obj[field] = JSON.parse(obj[field]);
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

		if (_.isArray(object.Items) && object.Items.length > 0)
			callback(null, object.Items[0].attrs);
		else
			callback(null, object.attrs);
	};
};

// In order to keep this file from getting huge, break out the definition
// of operations to different modules of related operations.
require('./operations/user')(DynamoDb);
require('./operations/application')(DynamoDb);
require('./operations/environment')(DynamoDb);
require('./operations/organization')(DynamoDb);
require('./operations/version')(DynamoDb);

module.exports = DynamoDb;
