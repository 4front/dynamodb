var _ = require('lodash');
var async = require('async');
var shortid = require('shortid');
var assert = require('assert');
var sinon = require('sinon');

require('dash-assert');

describe('Application', function() {
  var self;

  beforeEach(function() {
    self = this;

    this.dynamo = require('./dynamo-local');

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
    var domainName = shortid.generate() + '.com';
    var subDomain = 'www';

    _.extend(this.appData, {
      domainName: domainName,
      subDomain: subDomain
    });

    async.series([
      function(cb) {
        self.dynamo.createApplication(self.appData, function(err, app) {
          if (err) return cb(err);

          assert.isMatch(app, self.appData);
          cb();
        });
      },
      function(cb) {
        self.dynamo.getAppByDomainName(domainName, subDomain, function(err, app) {
          if (err) return cb(err);
          assert.isMatch(app, self.appData);
          cb();
        });
      },
      function(cb) {
        self.dynamo.getAppIdByDomainName(domainName, subDomain, function(err, appId) {
          if (err) return cb(err);
          assert.equal(appId, self.appData.appId);
          cb();
        });
      }
    ], done);
  });

  it('create application with existing domainName', function(done) {
    _.extend(this.appData, {
      domainName: shortid.generate() + '.com',
      subDomain: 'www'
    });

    async.series([
      function(cb) {
        self.dynamo.createApplication(self.appData, cb);
      },
      function(cb) {
        self.appData.appId = shortid.generate();
        self.appData.name = 'app-name-' + shortid.generate();

        self.dynamo.createApplication(self.appData, function(err) {
          assert.equal(err.code, 'domainNameTaken');
          cb();
        });
      },
      function(cb) {
        self.appData.subDomain = 'www2';

        // Create another app with same domainName but different subDomain
        self.dynamo.createApplication(self.appData, cb);
      }
    ], done);
  });

  it('get application by name', function(done) {
    self = this;

    async.series([
      function(cb) {
        self.dynamo.createApplication(self.appData, cb);
      },
      function(cb) {
        self.dynamo.getApplicationByName(self.appData.name, function(err, app) {
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
        self.dynamo.models.AppName.create({name: self.appData.name, appId: shortid.generate()}, cb);
      },
      function(cb) {
        self.dynamo.createApplication(self.appData, function(err) {
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
        self.dynamo.models.AppName.create(appName, cb);
      },
      function(cb) {
        self.dynamo.getAppName(appName.name, function(err, name) {
          assert.deepEqual(name, appName);
          cb();
        });
      }
    ], done);
  });

  it('deletes application', function(done) {
    async.series([
      function(cb) {
        self.dynamo.createApplication(self.appData, cb);
      },
      function(cb) {
        // Create a version
        self.dynamo.createVersion({
          appId: self.appData.appId,
          versionId: shortid.generate(),
          name: 'v1',
          userId: self.appData.ownerId,
          status: 'complete',
          manifest: {}
        }, cb);
      },
      function(cb) {
        self.dynamo.deleteApplication(self.appData.appId, cb);
      },
      function(cb) {
        self.dynamo.getApplication(self.appData.appId, function(err, app) {
          if (err) return cb(err);
          assert.isNull(app);
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
        self.dynamo.createApplication(appData, cb);
      },
      function(cb) {
        self.dynamo.updateApplication(updatedData, cb);
      },
      function(cb) {
        self.dynamo.getApplication(appData.appId, function(err, app) {
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
        self.dynamo.createApplication(self.appData, cb);
      },
      function(cb) {
        self.dynamo.transferApplication(self.appData.appId, newOrgId, cb);
      },
      function(cb) {
        self.dynamo.getApplication(self.appData.appId, function(err, app) {
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
          self.dynamo.createApplication(_.extend({}, self.appData, {
            appId: appId,
            name: 'app-' + appId,
            ownerId: userId
          }), cb1);
        }, cb);
      },
      function(cb) {
        self.dynamo.userApplications(userId, function(err, userAppIds) {
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
        self.dynamo.createApplication(appData, cb);
      },
      function(cb) {
        // split traffic 50/50 with v10
        self.dynamo.updateTrafficRules(appData.appId, 'production', updatedRules, cb);
      },
      function(cb) {
        self.dynamo.getApplication(appData.appId, function(err, app) {
          if (err) return cb(err);

          // verify that the test environment remained unchanged.
          assert.deepEqual(app.trafficRules.test, [{version: 'v3', rule: '*'}]);
          assert.deepEqual(app.trafficRules.production, updatedRules);
          cb();
        });
      }
    ], done);
  });

  it('deletes traffic rules for env', function(done) {
    var appData = {
      appId: shortid.generate(),
      orgId: shortid.generate(),
      ownerId: shortid.generate(),
      name: 'app-name-' + shortid.generate(),
      trafficRules: {
        prod: [
          {version: 'v1', rule: '*'}
        ],
        test: [
          {version: 'v3', rule: '*'}
        ]
      }
    };

    async.series([
      function(cb) {
        self.dynamo.createApplication(appData, cb);
      },
      function(cb) {
        // split traffic 50/50 with v10
        self.dynamo.deleteTrafficRules(appData.appId, 'test', cb);
      },
      function(cb) {
        self.dynamo.getApplication(appData.appId, function(err, app) {
          if (err) return cb(err);

          // verify that the test environment remained unchanged.
          assert.deepEqual(app.trafficRules.prod, [{version: 'v1', rule: '*'}]);
          assert.isUndefined(app.trafficRules.test);
          cb();
        });
      }
    ], done);
  });

  it('gets apps for domainName', function(done) {
    var domainName = shortid.generate() + '.net';
    var ownerId = shortid.generate();
    var orgId = shortid.generate();

    var appData = _.times(3, function(n) {
      return _.extend({}, appData, {
        appId: shortid.generate(),
        orgId: orgId,
        ownerId: ownerId,
        name: 'app-name-' + shortid.generate(),
        domainName: domainName,
        subDomain: n.toString()
      });
    });

    async.series([
      function(cb) {
        async.each(appData, self.dynamo.createApplication.bind(self.dynamo), cb);
      },
      function(cb) {
        self.dynamo.getAppsByDomain(domainName, function(err, data) {
          if (err) return cb(err);

          assert.noDifferences(['0', '1', '2'], _.map(data, 'subDomain'));
          cb();
        });
      }
    ], done);
  });

  describe('triggers lazy replicator', function() {
    beforeEach(function() {
      self = this;
      this.dynamo.options.lazyReplicator = {
        trigger: sinon.spy(function() {})
      };
    });

    it('when appId is missing', function(done) {
      var appId = shortid.generate();
      self.dynamo.getApplication(appId, function(err, app) {
        assert.isEmpty(app);
        assert.isTrue(self.dynamo.options.lazyReplicator.trigger.calledWith({
          source: 'dynamodb',
          region: 'us-west-2',
          tableName: '4front_applications',
          keys: {
            appId: {S: appId} //eslint-disable-line
          }
        }));
        done();
      });
    });

    it('when app domain is missing', function(done) {
      var domainName = shortid.generate();
      var subDomain = '@';
      self.dynamo.getAppByDomainName(domainName, subDomain, function(err, app) {
        assert.isEmpty(app);
        assert.isTrue(self.dynamo.options.lazyReplicator.trigger.calledWith({
          source: 'dynamodb',
          region: 'us-west-2',
          tableName: '4front_applications',
          keys: {
            domainName: {S: domainName}, //eslint-disable-line
            subDomain: {S: subDomain} //eslint-disable-line
          },
          index: 'domainNameIndex2'
        }));
        done();
      });
    });

    it('when appName is missing', function(done) {
      var appName = shortid.generate();
      self.dynamo.getApplicationByName(appName, function(err, app) {
        assert.isEmpty(app);
        assert.isTrue(self.dynamo.options.lazyReplicator.trigger.calledWith({
          source: 'dynamodb',
          region: 'us-west-2',
          tableName: '4front_appName',
          keys: {
            name: {S: appName} //eslint-disable-line
          }
        }));
        done();
      });
    });

    it('when appId is missing from appName', function(done) {
      var appId = shortid.generate();
      self.dynamo._getAppName(appId, function(err, app) {
        assert.isEmpty(app);
        assert.isTrue(self.dynamo.options.lazyReplicator.trigger.calledWith({
          source: 'dynamodb',
          region: 'us-west-2',
          tableName: '4front_appName',
          keys: {
            appId: {S: appId} //eslint-disable-line
          },
          index: 'appIdIndex'
        }));
        done();
      });
    });
  });
});
