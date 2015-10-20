var _ = require('lodash');
var async = require('async');
var shortid = require('shortid');
var assert = require('assert');

require('dash-assert');

describe('Application', function() {
  var dynamo = require('./dynamo-local');
  var self;

  beforeEach(function() {
    self = this;
    this.appData = {
      appId: shortid.generate(),
      orgId: shortid.generate(),
      ownerId: shortid.generate(),
      name: 'app-name-' + shortid.generate(),
      trafficRules: {
        prod: [
          {version: 'v1', rule: 'random:0.5'},
          {version: 'v2', rule: 'random:0.5'}
        ],
        test: [
          {version: 'v3', rule: '*'}
        ]
      }
    };
  });

  it('create and retrieve application', function(done) {
    async.series([
      function(cb) {
        dynamo.createApplication(self.appData, function(err, app) {
          if (err) return cb(err);

          assert.isMatch(app, self.appData);
          // assert.deepEqual(appData, _.pick(app, _.keys(self.appData)));
          cb();
        });
      },
      function(cb) {
        dynamo.getApplication(self.appData.appId, function(err, app) {
          if (err) return cb(err);

          assert.isMatch(app, self.appData);

          // assert.deepEqual(appData, _.pick(app, _.keys(self.appData)));
          cb();
        });
      }
    ], done);
  });

  it('get application by name', function(done) {
    self = this;

    async.series([
      function(cb) {
        dynamo.createApplication(self.appData, cb);
      },
      function(cb) {
        dynamo.getApplicationByName(self.appData.name, function(err, app) {
          if (err) return cb(err);

          assert.isMatch(app, self.appData);
          cb();
        });
      }
    ], done);
  });

  it('does not allow duplicate app names', function(done) {
    self = this;
    async.series([
      function(cb) {
        dynamo.models.AppName.create({name: self.appData.name, appId: shortid.generate()}, cb);
      },
      function(cb) {
        dynamo.createApplication(self.appData, function(err) {
          assert.ok(err);
          assert.equal(err.code, 'appNameExists');
          cb();
        });
      }
    ], done);
  });

  it('get appName', function(done) {
    var appName = {name: shortid.generate(), appId: shortid.generate()};
    async.series([
      function(cb) {
        dynamo.models.AppName.create(appName, cb);
      },
      function(cb) {
        dynamo.getAppName(appName.name, function(err, name) {
          assert.deepEqual(name, appName);
          cb();
        });
      }
    ], done);
  });

  it('deletes application', function(done) {
    async.series([
      function(cb) {
        dynamo.createApplication(self.appData, cb);
      },
      function(cb) {
        // Create a version
        dynamo.createVersion({
          appId: self.appData.appId,
          versionId: shortid.generate(),
          name: 'v1',
          userId: self.appData.ownerId,
          status: 'complete',
          manifest: {}
        }, cb);
      },
      function(cb) {
        dynamo.createDomain({
          appId: self.appData.appId,
          domain: shortid.generate() + '.domain.com',
          orgId: self.appData.orgId
        }, cb);
      },
      function(cb) {
        dynamo.deleteApplication(self.appData.appId, cb);
      },
      function(cb) {
        dynamo.getApplication(self.appData.appId, function(err, app) {
          if (err) return cb(err);
          assert.ok(_.isNull(app));
          cb();
        });
      }
    ], done);
  });

  it('update application', function(done) {
    var appData = _.extend({}, this.appData, {
      appId: shortid.generate()
    });

    // Update the name and domains
    var updatedData = _.extend({}, appData, {
      name: shortid.generate() + '-new-name',
    });

    // First create an application
    async.series([
      function(cb) {
        dynamo.createApplication(appData, cb);
      },
      function(cb) {
        dynamo.updateApplication(updatedData, cb);
      },
      function(cb) {
        dynamo.getApplication(appData.appId, function(err, app) {
          if (err) return cb(err);

          assert.equal(app.name, updatedData.name);
          cb();
        });
      }
    ], done);
  });

  it('transfer application', function(done) {
    var newOrgId = shortid.generate();

    async.series([
      function(cb) {
        dynamo.createApplication(self.appData, cb);
      },
      function(cb) {
        dynamo.transferApplication(self.appData.appId, newOrgId, cb);
      },
      function(cb) {
        dynamo.getApplication(self.appData.appId, function(err, app) {
          if (err) return cb(err);
          assert.equal(app.orgId, newOrgId);
          cb();
        });
      }
    ], done);
  });

  it('list user applications', function(done) {
    var appIds = _.times(3, function() {
      return shortid.generate();
    });
    var userId = shortid.generate();

    async.series([
      function(cb) {
        async.each(appIds, function(appId, cb1) {
          dynamo.createApplication(_.extend({}, self.appData, {
            appId: appId,
            name: 'app-' + appId,
            ownerId: userId
          }), cb1);
        }, cb);
      },
      function(cb) {
        dynamo.userApplications(userId, function(err, userAppIds) {
          assert.equal(userAppIds.length, 3);
          assert.noDifferences(appIds, userAppIds);
          cb();
        });
      }
    ], done);
  });

  it('updates traffic rules', function(done) {
    var appData = {
      appId: shortid.generate(),
      orgId: shortid.generate(),
      ownerId: shortid.generate(),
      name: 'app-name-' + shortid.generate(),
      trafficRules: {
        test: [
          {version: 'v3', rule: '*'}
        ]
      }
    };

    var updatedRules = [
      {version: 'v1', rule: 'random:0.5'},
      {version: 'v10', rule: 'random:0.5'}
    ];

    async.series([
      function(cb) {
        dynamo.createApplication(appData, cb);
      },
      function(cb) {
        // split traffic 50/50 with v10
        dynamo.updateTrafficRules(appData.appId, 'production', updatedRules, cb);
      },
      function(cb) {
        dynamo.getApplication(appData.appId, function(err, app) {
          if (err) return cb(err);

          // verify that the test environment remained unchanged.
          assert.deepEqual(app.trafficRules.test, [{version: 'v3', rule: '*'}]);
          assert.deepEqual(app.trafficRules.production, updatedRules);
          cb();
        });
      }
    ], done);
  });
});
