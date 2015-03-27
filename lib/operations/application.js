var async = require('async');
var _ = require('lodash');
var debug = require('debug')('4front:dynamo');

require('simple-errors');

module.exports = function(DynamoDb) {
	DynamoDb.prototype.createApplication = function(appData, callback) {
		var self = this;
	  var domains = appData.domains;
	  var appName = appData.name;

  	appData = _.omit(appData, "domains", "name");
  	var app = {};

	  async.series([
	  	// Create the AppName first so if it fails due to a duplicate name nothing else
	  	// has been written yet.
	    function(cb) {
	    	debug("creating appName %s", appName);
	    	self.createAppName(appData.appId, appName, function(err) {
	    		if (err) return cb(err);
	    		app.name = appName;
	    		cb();
	    	});
	    },
	    function(cb) {
	    	debug("creating app %s", appData.appId);
	      self.models.Application.create(appData, function(err, data) {
	        if (err)
	          return cb(err);

	        _.extend(app, data.attrs);

	        cb(null);
	      });
	    },
	    // Create the AppDomains
	    function(cb) {
	      if (!domains) return cb(null);

	      debug("creating app domains");
	      async.each(domains, function(domainName, cb1) {
	      	self.createDomain(appData.appId, domainName, function(err, domain) {
	      		if (err) return cb1(err);

	      		if (domain) {
	      			if (!app.domains)
  							app.domains = [];
  						app.domains.push(domainName);
	      		}
	      		cb1();
	      	});
				}, cb);	      		
	    }
	  ], function(err) {
	    if (err)
	      return callback(err);

	    callback(null, app);
	  });
	};

	DynamoDb.prototype.createAppName = function(appId, name, callback) {
		// Perform a conditional write to avoid collisions with existing domains
  	var params = {
  		ConditionExpression: '#name <> :name',
  		ExpressionAttributeNames: {'#name': 'name'},
  		ExpressionAttributeValues: {':name': name}
  	};

  	this.models.AppName.create({name: name, appId: appId}, params, function(err) {
  		if (err) {
  			if (err.code === "ConditionalCheckFailedException")
  				return callback(Error.create("App name " + name + " already exists", {code: "appNameExists"}));
  			else
  				return callback(err);
  		}

  		callback();
  	});
	};

	DynamoDb.prototype.createDomain = function(appId, domainName, callback) {
		// Perform a conditional write to avoid collisions with existing domains
  	var params = {
  		ConditionExpression: '#domain <> :domain',
  		ExpressionAttributeNames: {'#domain': 'domain'},
  		ExpressionAttributeValues: {':domain': domainName}
  	};

  	this.models.Domain.create({domain: domainName, appId: appId}, params, function(err, domain) {
  		if (err) {
  			if (err.code === "ConditionalCheckFailedException")
  				return callback(null, null);
  			else
  				return callback(err);
  		}

  		callback(null, domain);
  	});
	};

	DynamoDb.prototype.getApplication = function(appId, callback) {
		var self = this;
	  var app = {};
	  debug("getting application %s", appId);

	  async.parallel([
	    function(cb) {
	      self.models.Application.get(appId, function(err, data) {
	        if (err)
	          return cb(err);

	        if (!data) {
	          debug('appId %s not found', appId);
	          return cb(null);
	        }

	        app = _.extend(app, data.attrs);

	        cb(null);
	      });
	    },
	    function(cb) {
	      if (!app) return cb(null);

	      self.models.AppName.query(appId).usingIndex('appIdIndex').exec(function(err, data) {
	        if (err)
	          return cb(err);

	        if (data.Items.length == 0) {
	          debug("could not find appName for appId %s", appId);
	          return cb(null);
	        }

	        app.name = data.Items[0].get("name");
	        debug("found app name %s: %s", appId, app.name);
	        cb(null);
	      });
	    },
	    function(cb) {
	      if (!app) return cb(null);

	      self.models.Domain.query(appId).usingIndex('appIdIndex').exec(function(err, data) {
	        if (err)
	          return cb(err);

	        if (data.Items.length > 0) {
	          app.domains = _.map(data.Items, function(item) {
	            return item.attrs.domain;
	          });
	        }

	        cb(null);
	      });
	    }
	  ], function(err) {
	    if (err)
	      return callback(err);

	    if (!app.appId || !app.name)
	      return callback(null, null);

	    debug("found application %s", app.name);
	    callback(null, app);
	  });
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
};