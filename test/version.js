var _ = require('lodash');
var async = require('async');
var shortid = require('shortid');
var assert = require('assert');
var sinon = require('sinon');
var debug = require('debug')('4front:dynamo:version:test');

require('dash-assert');

describe('Version', function() {
  var self;

  beforeEach(function() {
    self = this;

    this.dynamo = require('./dynamo-local');

    this.versionDefaults = {
      versionId: shortid.generate(),
      appId: shortid.generate(),
      userId: shortid.generate(),
      versionNum: 1,
      name: 'v1',
      status: 'initiated',
      message: 'deployment message',
      manifest: {},
      duration: 1000
    };
  });

  it('create version', function(done) {
    async.series([
      function(cb) {
        self.dynamo.createVersion(self.versionDefaults, function(err, version) {
          if (err) debug('error creating version');
          if (err) return cb(err);
          assert.equal(version.versionId, self.versionDefaults.versionId);
          cb();
        });
      },
      function(cb) {
        var appId = self.versionDefaults.appId;
        var versionId = self.versionDefaults.versionId;
        self.dynamo.getVersion(appId, versionId, function(err, version) {
          if (err) debug('error getting version');
          if (err) return cb(err);

          assert.isMatch(version, self.versionDefaults);
          cb();
        });
      }
    ], done);
  });

  it('lists versions', function(done) {
    // Get version numbers 1 to 10 in shuffled order
    var maxVersionNum = 10;
    var versionNums = _.shuffle(_.range(1, maxVersionNum + 1));

    var versionData = _.map(versionNums, function(num) {
      return _.extend({}, self.versionDefaults, {
        name: 'v' + num,
        versionId: shortid.generate(),
        versionNum: num,
        status: 'complete'
      });
    });

    async.each(versionData, function(data, cb) {
      self.dynamo.createVersion(data, cb);
    }, function(err) {
      if (err) return done(err);

      self.dynamo.listVersions(self.versionDefaults.appId, {}, function(_err, versions) {
        if (_err) return done(_err);

        assert.equal(maxVersionNum, versions.length);
        done();
      });
    });
  });

  it('gets next version num', function(done) {
    var appId = shortid.generate();
    async.series([
      function(cb) {
        self.dynamo.nextVersionNum(appId, function(err, versionNum) {
          assert.equal(1, versionNum);
          cb();
        });
      },
      function(cb) {
        self.dynamo.createVersion(_.extend(self.versionDefaults,
          {appId: appId, versionNum: 1}), cb);
      },
      function(cb) {
        self.dynamo.nextVersionNum(appId, function(err, versionNum) {
          assert.equal(2, versionNum);
          cb();
        });
      }
    ], done);
  });

  it('gets most recent version', function(done) {
    var appId = shortid.generate();
    async.series([
      function(cb) {
        self.dynamo.createVersion(_.extend(self.versionDefaults,
          {appId: appId, versionNum: 1, versionId: shortid.generate()}), cb);
      },
      function(cb) {
        self.dynamo.createVersion(_.extend(self.versionDefaults,
          {appId: appId, versionNum: 2, versionId: shortid.generate()}), cb);
      },
      function(cb) {
        self.dynamo.mostRecentVersion(appId, function(err, mostRecentVersion) {
          if (err) return cb(err);
          // assert.isDefined(mostRecentVersion);
          assert.equal(2, mostRecentVersion.versionNum);
          cb();
        });
      }
    ], done);
  });

  it('updates version', function(done) {
    var appId = shortid.generate();
    var versionData = _.extend(this.versionDefaults, {appId: appId, versionNum: 1});

    async.series([
      function(cb) {
        self.dynamo.createVersion(versionData, cb);
      },
      function(cb) {
        _.extend(versionData, {
          name: 'new name',
          message: 'new message'
        });

        self.dynamo.updateVersion(versionData, cb);
      },
      function(cb) {
        self.dynamo.getVersion(versionData.appId, versionData.versionId, function(err, version) {
          assert.isMatch(version, _.pick(versionData, 'name', 'message'));
          cb();
        });
      }
    ], done);
  });

  it('returns version count', function(done) {
    var versionNums = _.range(1, 5);

    var versionData = _.map(versionNums, function(num) {
      return _.extend({}, self.versionDefaults, {
        name: 'v' + num,
        versionId: shortid.generate(),
        versionNum: num,
        status: 'complete'
      });
    });

    async.each(versionData, function(data, cb) {
      self.dynamo.createVersion(data, cb);
    }, function(err) {
      if (err) return done(err);

      self.dynamo.getVersionCount(self.versionDefaults.appId, function(_err, count) {
        if (_err) return done(_err);

        assert.equal(4, count);
        done();
      });
    });
  });

  it('deletes version', function(done) {
    async.series([
      function(cb) {
        self.dynamo.createVersion(self.versionDefaults, cb);
      },
      function(cb) {
        self.dynamo.deleteVersion(self.versionDefaults.appId,
          self.versionDefaults.versionId, cb);
      }
    ], done);
  });

  it('triggers lazy replicator when versionId not found', function(done) {
    this.dynamo.options.lazyReplicator = {
      trigger: sinon.spy(function() {})
    };

    var appId = shortid.generate();
    var versionId = shortid.generate();
    self.dynamo.getVersion(appId, versionId, function(err, version) {
      assert.isEmpty(version);
      assert.isTrue(self.dynamo.options.lazyReplicator.trigger.calledWith({
        source: 'dynamodb',
        tableName: '4front_versions',
        region: 'us-west-2',
        keys: {
          appId: {S: appId}, //eslint-disable-line
          versionId: {S: versionId} //eslint-disable-line
        }
      }));
      done();
    });
  });
});
