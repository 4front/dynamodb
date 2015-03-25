var async = require('async');
var debug = require('debug')('4front-dynamo:application');

module.exports = function(DynamoDb) {
	DynamoDb.prototype.createApplication = function(appData, callback) {
		var self = this;
	  var domain = appData.domain;
	  var appName = appData.name;
	  var orgId = appData.orgId;

  	debug("writing application to dynamo: " + JSON.stringify(appData));
  	appData = _.omit(appData, "domain", "name");

	  // Ensure the orgId attribute is not present if the value is falsey.
	  if (!appData.orgId)
	    delete appData.orgId;

	  // Stringify each of the JSON fields.
	  stringifyJsonFields(self.Application, appData);

	  async.waterfall([
	    function(cb) {
	      self.models.Application.create(appData, function(err, data) {
	        if (err)
	          return cb(err);

	        // Convert the JSON fields back to objects
	        var app = data.attrs;
	        parseJsonFields(self.Application, app);

	        cb(null, app);
	      });
	    },
	    // Create the AppName
	    function(app, cb) {
	      self.models.AppName.create({name: appName, appId: app.appId}, function(err, data) {
	        if (err)
	          return cb(err);

	        app.name = appName;
	        cb(null, app);
	      });
	    },
	    // Create the AppDomain
	    function(app, cb) {
	      if (!domain)
	        return cb(null, app);

	      self.models.Domain.create({domain: domain, appId: app.appId}, function(err, domain) {
	        if (err)
	          return cb(err);

	        app.domain = domain;
	        cb(null, app);
	      });
	    },
	    // Create the UserApplication association
	    function(app, cb) {
	      // Make the owner of the applicaton an administrator
	      self.UserApplication.create({appId: app.appId, userId: app.ownerId, role: "admin"}, function(err, data) {
	        cb(err, app);
	      });
	    }
	  ], function(err, app) {
	    if (err)
	      return callback(err);

	    callback(null, app);
	  });
	};
};