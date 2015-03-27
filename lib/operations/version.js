var async = require('async');
var _ = require('lodash');
var debug = require('debug')('4front:dynamo');

module.exports = function(DynamoDb) {
	DynamoDb.prototype.createVersion = function(versionData, callback) {
		this.models.Version.create(versionData, function(err, data) {
			if (err) return callback(err);
			callback(null, data.attrs);
		});
	};

	DynamoDb.prototype.getVersion = function(versionId, callback) {
		this.models.Version.get(versionId, function(err, version) {
			if (err) return callback(err);

			if (!version) return callback(null, null);
			callback(null, version.attrs);
		});
	};

	// Find the versions that are deployed to a specific environment
	DynamoDb.prototype.versionsDeployedToEnv = function(appId, env, callback) {
		debug("find versions deployed to env %s", env);
		this.models.Version.query(appId)
			.usingIndex('appIdVersionNumIndex')
			// Filter where the env key exists in deployments with a value greater than 0
			.filterExpression('attribute_exists(#d.' + env + ') AND #d.' + env + ' > :zero')
			.expressionAttributeNames({'#d': 'deployments'})
			.expressionAttributeValues({':zero': 0})
			.exec(function(err, data) {
				if (err) return callback(err);

				debugger;
				callback(null, _.map(data.Items, 'attrs'));
			});
	};
};