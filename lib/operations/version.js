var async = require('async');
var _ = require('lodash');
var debug = require('debug')('4front:dynamodb');

module.exports = function(DynamoDb) {
	DynamoDb.prototype.createVersion = function(versionData, callback) {
		this.models.Version.create(versionData, this._itemCallback(callback));
	};

	DynamoDb.prototype.getVersion = function(versionId, callback) {
		this.models.Version.get(versionId, this._itemCallback(callback));
	};

	// List the versions for an app
	DynamoDb.prototype.listVersions = function(options, callback) {
		// var self = this;
		debug("list versions for app %s", options.appId);

		var chain = this.models.Version.query(options.appId)
			.usingIndex('appIdVersionNumIndex');

		if (options.env)
			chain = chain.filter('environments').contains(options.env);
		if (options.limit)
			chain = chain.limit(options.limit);

		chain.descending()
			.exec(this._listCallback(callback));
	};

	// Just update the traffic version allocation for a single environment. This is less risky
	// than updating the entire application object.
	DynamoDb.prototype.updateDeployedVersions = function(appId, env, versions, callback) {
		var params = {
			UpdateExpression: "SET #deployedVersions." + env + "=:versions",
			ExpressionAttributeNames: { "#deployedVersions": "deployedVersions" },
			ExpressionAttributeValues: {":versions": versions }
		};

		this.models.Application.update({appId:appId}, params, this._itemCallback(callback));
	};

	// Get the next version for an app.
	DynamoDb.prototype.nextVersionNum = function(appId, callback) {
		this.models.Version.query(appId)
	    .usingIndex('appIdVersionNumIndex')
	    .attributes(['versionNum'])
	    .limit(1)
	    .descending()
	    .exec(function(err, data) {
	      if (err) return callback(err);

	      if (data.Items.length == 0)
	        return callback(null, 1);

	      callback(null, data.Items[0].get('versionNum') + 1);
	    });
	}
};
