var _ = require('lodash');
var env = require('../tables/env');

module.exports = function(options) {
	if (!_.isObject(options.dynamo))
		throw new Error("Missing dynamo option");

	return function(req, res, next) {
		if (!req.ext.virtualEnv)
			return next(Error.http(400, "Missing req.ext.virtualEnv"));
		if (!req.ext.virtualApp)
			return next(Error.http(400, "Missing req.ext.virtualApp"));

		// Load the environment variables from dynamo for this app and environment.
		env.getVariables(req.ext.virtualApp.appId, req.ext.virtualEnv, function() {

		})

		req.ext.env = {

		};
	};
};