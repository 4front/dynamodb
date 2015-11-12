var async = require('async');
var shortid = require('shortid');
var assert = require('assert');

require('dash-assert');

describe('env', function() {
  var dynamo = require('./dynamo-local');
  var self;

  beforeEach(function() {
    self = this;

    this.appData = {
      appId: shortid.generate(),
      name: 'app-' + shortid.generate(),
      orgId: shortid.generate(),
      ownerId: shortid.generate(),
      env: {}
    };

    this.envName = 'production';
  });

  it('sets new variable for non-existent environment', function(done) {
    var key = 'DB_CONNECTION';
    var value = 'connection_string';

    async.series([
      function(cb) {
        dynamo.createApplication(self.appData, cb);
      },
      function(cb) {
        var options = {
          appId: self.appData.appId,
          virtualEnv: self.envName,
          key: key,
          value: value
        };

        dynamo.setEnvironmentVariable(options, cb);
      },
      function(cb) {
        dynamo.getApplication(self.appData.appId, function(err, app) {
          if (err) return cb(err);

          assert.equal(app.env[self.envName][key].value, value);
          cb();
        });
      }
    ], done);
  });

  it('new variable for existing environment', function(done) {
    var key = 'KEY', value = 'value';

    this.appData.env[this.envName] = {};

    async.series([
      function(cb) {
        dynamo.createApplication(self.appData, cb);
      },
      function(cb) {
        var options = {
          appId: self.appData.appId,
          virtualEnv: self.envName,
          key: key,
          value: value
        };

        dynamo.setEnvironmentVariable(options, cb);
      },
      function(cb) {
        dynamo.getApplication(self.appData.appId, function(err, app) {
          if (err) return cb(err);

          assert.equal(app.env[self.envName][key].value, value);
          cb();
        });
      }
    ], done);
  });

  it('update existing env variable', function(done) {
    var key = 'KEY', value = 'value';

    this.appData.env[this.envName] = {key: 'old_value'};

    async.series([
      function(cb) {
        dynamo.createApplication(self.appData, cb);
      },
      function(cb) {
        var options = {
          appId: self.appData.appId,
          virtualEnv: self.envName,
          key: key,
          value: value
        };

        dynamo.setEnvironmentVariable(options, cb);
      },
      function(cb) {
        dynamo.getApplication(self.appData.appId, function(err, app) {
          if (err) return cb(err);

          assert.equal(app.env[self.envName][key].value, value);
          cb();
        });
      }
    ], done);
  });

  it('encrypted env variable', function(done) {
    var key = 'KEY';
    var value = 'sensitive_value';

    async.series([
      function(cb) {
        dynamo.createApplication(self.appData, cb);
      },
      function(cb) {
        var options = {
          appId: self.appData.appId,
          virtualEnv: self.envName,
          key: key,
          value: value,
          encrypt: true
        };

        dynamo.setEnvironmentVariable(options, cb);
      },
      function(cb) {
        dynamo.getApplication(self.appData.appId, function(err, app) {
          if (err) return cb(err);

          var envVarValue = app.env[self.envName][key];
          assert.isTrue(envVarValue.encrypted);
          assert.equal(envVarValue.value, value);
          cb();
        });
      }
    ], done);
  });

  it('deletes existing env variable', function(done) {
    this.appData.env.test = {
      'KEY': {
        value: 'old_value'
      }
    };

    async.series([
      function(cb) {
        dynamo.createApplication(self.appData, cb);
      },
      function(cb) {
        dynamo.deleteEnvironmentVariable(self.appData.appId, 'test', 'KEY', cb);
      },
      function(cb) {
        dynamo.getApplication(self.appData.appId, function(err, app) {
          if (err) return cb(err);

          assert.isUndefined(app.env.test.KEY);
          cb();
        });
      }
    ], done);
  });

  it('delete non-existent env variable', function(done) {
    this.appData.env.test = {};

    async.series([
      function(cb) {
        dynamo.createApplication(self.appData, cb);
      },
      function(cb) {
        dynamo.deleteEnvironmentVariable(self.appData.appId, 'production', 'KEY', cb);
      },
      function(cb) {
        dynamo.getApplication(self.appData.appId, function(err, app) {
          if (err) return cb(err);

          assert.deepEqual(app.env, self.appData.env);
          cb();
        });
      }
    ], done);
  });
});
