var async = require('async');
var _ = require('lodash');
var debug = require('debug')('4front:dynamodb');

require('simple-errors');

module.exports = function(DynamoDb) {
  var jsonFields = ['trafficControlRules'];

  DynamoDb.prototype.createApplication = function(appData, callback) {
    var self = this;
    var appName = appData.name;

    debug('create application %s', appName);

    var omitFields = ['name'];
    if (_.isEmpty(appData.domainName)) {
      omitFields.push('domainName', 'subDomain');
    }
    appData = _.omit(appData, omitFields);

    var app = {};

    // Stringify each of the JSON fields.
    this._stringifyJsonFields(jsonFields, appData);

    async.series([
      function(cb) {
        if (_.isUndefined(appData.domainName)) return cb();

        // Verify that the domainName is not already being used for a different app.
        debug('verify domain %s.%s does not exist', appData.subDomain, appData.domainName);
        self.getAppByDomainName(appData.domainName, appData.subDomain, function(err, existingApp) {
          if (err) return cb(err);
          if (_.isEmpty(existingApp) === false) {
            return cb(Error.create('Domain name ' + appData.subDomain
              + '.' + appData.domainName + ' already taken.',
              {code: 'domainNameTaken'}));
          }
          cb();
        });
      },
      // Create the AppName first so if it fails due to a duplicate name nothing else
      // has been written yet.
      function(cb) {
        debug('creating appName %s', appName);
        self.createAppName(appData.appId, appName, function(err) {
          if (err) return cb(err);
          app.name = appName;
          cb();
        });
      },
      function(cb) {
        debug('creating app %s', appData.appId);
        self.models.Application.create(appData, function(err, data) {
          if (err) return cb(err);

          self._parseJsonFields(jsonFields, data.attrs);
          _.extend(app, data.attrs);

          cb(null);
        });
      }
    ], function(err) {
      if (err) return callback(err);

      callback(null, app);
    });
  };

  DynamoDb.prototype.getAppName = function(name, callback) {
    this.incrementRead();
    this.models.AppName.get(name, this._itemCallback(callback));
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
        if (err.code === 'ConditionalCheckFailedException') {
          return callback(Error.create('App name ' + name + ' already exists', {
            code: 'appNameExists'
          }));
        }
        return callback(err);
      }

      callback();
    });
  };

  DynamoDb.prototype._getApplication = function(appId, name, callback) {
    var self = this;
    debug('getting application %s', appId);

    async.waterfall([
      function(cb) {
        self._getApplicationBase(appId, name, cb);
      },
      function(app, cb) {
        if (!app) return cb(null, null);

        // If the app has a domainName, then don't go get the legacy domains
        if (!_.isEmpty(app.domainName)) return cb(null, app);

        self._getLegacyDomains(appId, function(err, legacyDomains) {
          if (err) return cb(err);
          app.legacyDomains = legacyDomains;
          cb(null, app);
        });
      }
    ], callback);
  };

  // Get the root application and appName in parallel
  DynamoDb.prototype._getApplicationBase = function(appId, name, callback) {
    var app = {};
    var self = this;

    async.parallel([
      function(cb) {
        self.incrementRead();
        self.models.Application.get(appId, function(err, data) {
          if (err) {
            return cb(Error.create('Error fetching application from Dynamo: ' + err.message, {
              code: err.code,
              tableName: self.models.Application.tableName()
            }));
          }

          if (!data) {
            debug('appId %s not found', appId);
            return cb(null);
          }

          // Decrypt any encrypted environment variables
          if (_.isObject(data.attrs.env)) {
            _.each(data.attrs.env, function(map) {
              _.each(map, function(value) {
                // Decrypt the value in place.
                if (value.encrypted === true) {
                  value.value = self.crypto.decrypt(value.value);
                }
              });
            });
          }

          self._parseJsonFields(jsonFields, data.attrs);
          _.extend(app, data.attrs);

          cb(null);
        });
      },
      function(cb) {
        // If we already know the app name, just assign it.
        if (name) {
          app.name = name;
          return cb();
        }

        self._getAppName(appId, function(err, appName) {
          if (err) return cb(err);
          if (appName) app.name = appName;
          cb();
        });
      }
    ], function(err) {
      if (err) return callback(err);
      callback(null, _.isEmpty(app) || !app.appId ? null : app);
    });
  };

  DynamoDb.prototype._getAppName = function(appId, callback) {
    debug('query AppName for %s', appId);
    this.incrementRead();
    this.models.AppName.query(appId).usingIndex('appIdIndex').exec(function(err, data) {
      if (err) return callback(err);

      if (data.Items.length === 0) {
        debug('could not find appName for appId %s', appId);
        return callback(null);
      }

      var appName = data.Items[0].get('name');
      debug('found app name %s: %s', appId, appName);
      callback(null, appName);
    });
  };

  DynamoDb.prototype._getLegacyDomains = function(appId, callback) {
    debug('query Domain for appId', appId);
    this.incrementRead();
    this.models.LegacyDomain.query(appId)
      .usingIndex('appIdIndex')
      .exec(this._listCallback(callback));
  };

  DynamoDb.prototype.getApplication = function(appId, callback) {
    this._getApplication(appId, null, callback);
  };

  // Find an application given it's unique name
  DynamoDb.prototype.getApplicationByName = function(name, callback) {
    var self = this;
    this.incrementRead();
    this.models.AppName.get(name, function(err, item) {
      if (err) return callback(err);

      if (!item) return callback(null, null);

      var appId = item.attrs.appId;
      self._getApplication(appId, name, callback);
    });
  };

  // Get the application by domainName and subDomain
  DynamoDb.prototype.getAppByDomainName = function(domainName, subDomain, callback) {
    var self = this;

    async.waterfall([
      function(cb) {
        self.incrementRead();
        self.models.Application.query(domainName, subDomain)
          .usingIndex('domainNameIndex2')
          .where('subDomain')
          .equals(subDomain)
          .exec(self._itemCallback(cb));
      },
      function(app, cb) {
        if (!app) return cb(null, null);

        self._getAppName(app.appId, function(err, appName) {
          if (err) return cb(err);
          // If we can't find the appName, return null.
          if (!appName) return cb(null, null);

          app.name = appName;
          cb(null, app);
        });
      }
    ], callback);
  };

  // Get the subDomains
  DynamoDb.prototype.getAppsByDomain = function(domainName, callback) {
    this.incrementRead();
    this.models.Application.query(domainName)
      .usingIndex('domainNameIndex2')
      .projectionExpression('appId, subDomain')
      .exec(this._listCallback(callback));
  };

  // Update an application in Dynamo
  DynamoDb.prototype.updateApplication = function(appData, callback) {
    var self = this;
    var appName = appData.name;

    appData = _.omit(appData, 'name');
    var updatedApp = {};

    async.series([
      function(cb) {
        debug('updating application ' + appData.appId + ' in Dynamo');
        self._stringifyJsonFields(jsonFields, appData);

        self.models.Application.update(appData, function(err, app) {
          if (err) return cb(err);

          self._parseJsonFields(jsonFields, app.attrs);
          _.extend(updatedApp, app.attrs);
          cb(null);
        });
      },
      function(cb) {
        self.renameApplication(appData.appId, appName, cb);
      }
    ], function(err) {
      if (err) return callback(err);

      _.extend(updatedApp, {
        name: appName
      });

      callback(null, updatedApp);
    });
  };

  DynamoDb.prototype.renameApplication = function(appId, name, callback) {
    var self = this;
    // Get the existing name for this app
    this.models.AppName.query(appId)
      .usingIndex('appIdIndex')
      .exec(function(err, data) {
        if (err) return callback(err);

        var existingName;
        if (data.Items.length > 0) {
          existingName = data.Items[0].get('name');
        }

        // If the new name is the same as the existing name
        if (existingName === name) return callback();

        var tasks = [];
        if (existingName !== null) {
          tasks.push(function(cb) {
            self.models.AppName.destroy(existingName, cb);
          });
        }

        tasks.push(function(cb) {
          var params = {
            ConditionExpression: '#appName <> :name',
            ExpressionAttributeNames: {'#appName': 'name'},
            ExpressionAttributeValues: {':name': name}
          };

          self.models.AppName.create({name: name, appId: appId}, params, cb);
        });

        async.series(tasks, callback);
      });
  };

  DynamoDb.prototype.deleteApplication = function(appId, callback) {
    var self = this;

    debug('delete application %s', appId);
    async.parallel({
      names: function(cb) {
        self.models.AppName.query(appId)
          .expressionAttributeNames({'#name': 'name'})
          .projectionExpression('#name')
          .usingIndex('appIdIndex')
          .exec(cb);
      },
      domains: function(cb) {
        self.models.LegacyDomain.query(appId)
          .expressionAttributeNames({'#domain': 'domain'})
          .projectionExpression('#domain')
          .usingIndex('appIdIndex')
          .exec(cb);
      },
      versions: function(cb) {
        self.models.Version.query(appId)
          .projectionExpression('versionId')
          .usingIndex('appIdVersionNumIndex2')
          .exec(cb);
      }
    }, function(err, results) {
      if (err) return callback(err);

      var deleteOps = [];
      _.each(results.domains.Items, function(item) {
        deleteOps.push(function(cb) {
          // Update the domain to have a null appId.
          debug('detaching app from domain %s', item.attrs.domain);
          self.models.LegacyDomain.update({domain: item.attrs.domain, appId: null}, cb);
        });
      });

      _.each(results.names.Items, function(item) {
        deleteOps.push(function(cb) {
          debug('deleting appName %s', item.attrs.name);
          self.models.AppName.destroy(item.attrs.name, cb);
        });
      });

      _.each(results.versions.Items, function(item) {
        deleteOps.push(function(cb) {
          debug('deleting app version %s', item.attrs.versionId);
          self.models.Version.destroy(appId, item.attrs.versionId, cb);
        });
      });

      deleteOps.push(function(cb) {
        debug('deleting %s from applications table', appId);
        self.models.Application.destroy(appId, cb);
      });

      async.parallel(deleteOps, function(_err) {
        if (_err) return callback(_err);
        debug('done deleting app %s from dynamo', appId);
        callback();
      });
    });
  };

  DynamoDb.prototype.updateTrafficRules = function(appId, env, trafficRules, callback) {
    // Just update the traffic version allocation for a single environment. This is less risky
    // than updating the entire application object.
    var params = {
      UpdateExpression: 'SET #trafficRules.#env=:trafficRules',
      ExpressionAttributeNames: {
        '#trafficRules': 'trafficRules',
        '#env': env
      },
      ExpressionAttributeValues: {':trafficRules': trafficRules}
    };

    this.models.Application.update({appId: appId}, params, this._itemCallback(callback));
  };

  DynamoDb.prototype.deleteTrafficRules = function(appId, env, callback) {
    var params = {
      UpdateExpression: 'REMOVE #trafficRules.#env',
      ExpressionAttributeNames: {
        '#trafficRules': 'trafficRules',
        '#env': env
      }
    };

    this.models.Application.update({appId: appId}, params, this._itemCallback(callback));
  };

  DynamoDb.prototype.transferApplication = function(appId, orgId, callback) {
    this.models.Application.update({appId: appId, orgId: orgId}, callback);
  };

  DynamoDb.prototype.userApplications = function(userId, callback) {
    this.models.Application.query(userId)
      .usingIndex('ownerIdIndex')
      .projectionExpression('appId')
      .exec(function(err, data) {
        if (err) return callback(err);

        var appIds = _.map(data.Items, function(item) {
          return item.attrs.appId;
        });

        callback(null, appIds);
      });
  };
};
