var async = require('async');
var _ = require('lodash');
var debug = require('debug')('4front:dynamo');

require('simple-errors');

module.exports = function(DynamoDb) {
	var jsonFields = ['trafficControlRules', 'authConfig', 'configSettings'];

	DynamoDb.prototype.createApplication = function(appData, callback) {
		var self = this;
	  var domains = appData.domains;
	  var appName = appData.name;

  	appData = _.omit(appData, "domains", "name");
  	var app = {};

		// Stringify each of the JSON fields.
  	this._stringifyJsonFields(jsonFields, appData);

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

					self._parseJsonFields(jsonFields, data.attrs);
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

					self._parseJsonFields(jsonFields, data.attrs);
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

	// Update an application in Dynamo
	DynamoDb.prototype.updateApplication = function(appData, callback) {
		debugger;

	  var self = this;
	  var appName = appData.name;
	  var domains = appData.domains || [];

	  appData = _.omit(appData, 'name', 'domains');
	  var updatedApp = {};

	  this.models.Domain.query(appData.appId).usingIndex('appIdIndex').exec(function(err, data) {
	    if (err) return callback(err);

	    var existingDomains = _.map(data.Items, function(item) {
	      return item.get('domain');
	    });

	    // Get the domains that have been added and deleted.
	    var newDomains = _.difference(domains, existingDomains);
	    var deletedDomains = _.difference(existingDomains, domains);

	    var parallelTasks = [];

	    parallelTasks.push(function(cb) {
	      debug("updating application " + appData.appId + " in Dynamo");
				self._stringifyJsonFields(jsonFields, appData);

	      // Explicitly specify what app attributes should get written to dynamo.
	      var updateAttrs = _.pick(appData, 'appId', 'orgId', 'configSettings',
	        'authConfig', 'requireSsl', 'snapshotsEnabled');

	      self.models.Application.update(updateAttrs, function(err, app) {
	        if (err)
	          return cb(err);

	        self._parseJsonFields(jsonFields, app.attrs);
	        _.extend(updatedApp, app.attrs);
	        cb(null);
	      });
	    });

	    if (newDomains.length > 0) {
	      debug("adding new domains: %s", newDomains);
	      parallelTasks.push(function(cb) {

	        async.each(newDomains, function(domain, cb1) {
	          // Use a conditional expression to ensure that an existing domain can't be overwritten
	          var params = {
	            ConditionExpression: '#d <> :a',
	            ExpressionAttributeNames: {'#d' : 'domain'},
	            ExpressionAttributeValues: { ':a':  domain}
	          };

	          self.models.Domain.create({ appId: appData.appId, domain: domain}, params, function(err) {
	            if (err) {
	              if (/^ConditionalCheckFailedException/.test(err.toString()))
	                return cb1(Error.create("Custom domain " + domain + " is not available", {code: "customDomainNotAvailable"}));
	              else
	                return cb1(err);
	            }
	            cb1();
	          });
	        }, cb);
	      });
	    }

	    if (deletedDomains.length > 0) {
	      parallelTasks.push(function(cb) {
	        async.each(deletedDomains, function(domain, cb1) {
	          self.models.Domain.destroy({domain:domain}, cb1);
	        }, cb);
	      });
	    }

	    parallelTasks.push(function(cb) {
	      if (!appName)
	        return cb(null);

	      debug("updating appName for application " + appData.appId + " in Dynamo to " + appName);
	      self.models.AppName.update({ appId: appData.appId, name: appName }, function(err) {
	        if (err)
	          return cb(err);

	        debug("AppName updated for application %s", appData.appId);
	        cb(null);
	      });
	    });

	    async.parallel(parallelTasks, function(err) {
	      if (err)
	        return callback(err);

	      _.extend(updatedApp, {
	        name: appName,
	        domains: domains
	      });

	      debug("Dynamo update of application " + appData.appId + " complete");
	      callback(null, updatedApp);
	    });
	  });
	};

	DynamoDb.prototype.deleteApplication = function(appId, callback) {
	  var self = this;

	  async.parallel({
	    names: function(cb) {
	      self.models.AppName.query(appId).attributes(['name']).usingIndex('appIdIndex').exec(cb);
	    },
	    domains: function(cb) {
	      self.models.Domain.query(appId).attributes(['domain']).usingIndex('appIdIndex').exec(cb);
	    },
	    versions: function(cb) {
	      self.models.Version.query(appId).attributes(['versionId']).usingIndex('appIdVersionNumIndex').exec(cb);
	    }
	  }, function(err, results) {
	    if (err) return callback(err);

	    var deleteOps = [];
	    _.each(results.domains.Items, function(item) {
	      deleteOps.push(function(cb) {
	        debug("deleting app domain %s", item.attrs.domain);
	        self.models.Domain.destroy(item.attrs.domain, cb);
	      });
	    });

	    _.each(results.names.Items, function(item) {
	      deleteOps.push(function(cb) {
	        debug("deleting appName %s", item.attrs.name);
	        self.models.AppName.destroy(item.attrs.name, cb);
	      });
	    });

	    _.each(results.versions.Items, function(item) {
	      deleteOps.push(function(cb) {
	        debug("deleting app version %s", item.attrs.versionId);
	        self.models.Version.destroy(item.attrs.versionId, cb);
	      });
	    });

	    deleteOps.push(function(cb) {
	      debug("deleting %s from applications table", appId);
	      self.models.Application.destroy(appId, cb);
	    });

	    async.parallel(deleteOps, function(err) {
	      if (err) return callback(err);
	      debug("done deleting app %s from dynamo", appId);
	      callback();
	    });
	  });
	};

	DynamoDb.prototype.transferApplication = function(appId, orgId, callback) {
		this.models.Application.update({appId: appId, orgId: orgId}, callback);
	};

	// Get the list of appIds belonging to an organization
	DynamoDb.prototype.orgApplications = function(orgId, callback) {
    this.models.Application.query(orgId)
      .usingIndex('orgIdIndex')
      .attributes(['appId'])
      .exec(function(err, data) {
        if (err) return callback(err);

        var appIds = _.map(data.Items, function(item) {
          return item.attrs.appId;
        });

        callback(null, appIds);
      });
	};
};
