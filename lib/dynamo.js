var vogels = require('vogels');
var camelCase = require('camel-case');
var modelDefinitions = require('./models');

function DynamoDb(dynamoDb, options) {
	options = _.defaults(options, {
		tablePrefix: null,
		modelExtensions: {}
	});

	// Set the vogels dynamo driver
	vogels.dynamoDriver(dynamoDb);

	var self = this;
	this.models = {};

	modelDefinitions.forEach(function(defn, type) {
		// Check if extended model attributes were provided. If so merge
		// them on top of the base model definition.
		var extensions = modelExtensions[type];
		if (modelExtensions[key])
			_.merge(defn, modelExtensions[type]);

		// If a tablePrefix was provided, tack it on now.
		if (options.tablePrefix)
			defn.tableName = options.tablePrefix + defn.tableName;

		self.models[type] = vogels.define(type, defn);
	});
}

// In order to keep this file from getting huge, break out the definition 
// of operations to different modules of related operations.
require('./operations/application')(DynamoDb);
require('./operations/environment')(DynamoDb);
require('./operations/organization')(DynamoDb);

module.exports = DynamoDb;