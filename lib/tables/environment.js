var async = require('async');

module.exports = function(DynamoDb)) {
	DynamoDb.prototype.createEnvironment = function(envData, callback) {
		this.models.Environment.create(envData, function(err, data) {
			if (err) return callback(err);

			callback(null, data.attrs);
		});
	};

	DynamoDb.prototype.deleteEnvironment = function(orgId, envName, callback) {
		this.models.Environment.destroy({orgId: orgId, name: envName}, callback);	
	};

	DynamoDb.prototype.updateEnvironment = function(envData) {
		this.models.Environment.update(envData, callback);
	};
};