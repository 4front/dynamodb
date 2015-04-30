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
					{version:'v1', rule:'random:0.5'},
					{version:'v2', rule:'random:0.5'}
				],
				test: [
					{version:'v3', rule:'*'}
				]
			}
		};
	});

	it('create and retrieve application', function(done) {
		var appData = _.extend(this.appData, {
			domains: ['www.' + shortid.generate() + '.com']
		});

		async.series([
			function(cb) {
				dynamo.createApplication(appData, function(err, app) {
					if (err) return cb(err);

					assert.deepEqual(appData, _.pick(app, _.keys(appData)));
					cb();
				});
			},
			function(cb) {
				dynamo.getApplication(appData.appId, function(err, app) {
					if (err) return cb(err);

					assert.deepEqual(appData, _.pick(app, _.keys(appData)));
					cb();
				});
			}
		], done);
	});

	it('get application by name', function(done) {
		var self = this;

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

	it('get domain', function(done) {
		var domain = shortid.generate() + '.com';
		var appId = shortid.generate();

		async.series([
			function(cb){
				dynamo.models.Domain.create({domain: domain, appId: appId}, cb);
			},
			function(cb) {
				dynamo.getDomain(domain, function(err, data) {
					if (err) return done(err);

					assert.equal(data.domain, domain);
					assert.equal(data.appId, appId);
					cb();
				});
			}
		], done);
	});

	it('does not allow duplicate domains', function(done) {
		var self = this;
		var domain = "www." + shortid.generate() + ".com";
		async.series([
			function(cb) {
				dynamo.models.Domain.create({domain:domain, appId: shortid.generate()}, cb);
			},
			function(cb) {
				dynamo.createApplication(_.extend(self.appData, {domains: [domain]}), function(err, app) {
					if (err) return cb(err);

					assert.ok(!app.domains);
					cb();
				});
			}
		], done);
	});

	it('does not allow duplicate app names', function(done) {
		var self = this;
		async.series([
			function(cb) {
				dynamo.models.AppName.create({name: self.appData.name, appId: shortid.generate()}, cb);
			},
			function(cb) {
				dynamo.createApplication(self.appData, function(err) {
					assert.ok(err);
					assert.equal(err.code, "appNameExists");
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
		var appData = _.extend(this.appData, {
			domains: ['www.' + shortid.generate() + '.com']
		});

		async.series([
			function(cb) {
				dynamo.createApplication(appData, cb);
			},
			function(cb) {
				dynamo.deleteApplication(appData.appId, cb);
			},
			function(cb) {
				dynamo.getApplication(appData.appId, function(err, app) {
					if (err) return cb(err);
					assert.ok(_.isNull(app));
					cb();
				})
			}
		], done);
	});

	it('update application', function(done) {
		var appData = _.extend({}, this.appData, {
			appId: shortid.generate(),
			domains: ['www.' + shortid.generate() + '.com', 'www.' + shortid.generate() + '.com']
		});

		// Update the name and domains
		var updatedData = _.extend({}, appData, {
			name: shortid.generate() + '-new-name',
			domains: [appData.domains[0], 'www.' + shortid.generate() + '.com']
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
					assert.noDifferences(app.domains, updatedData.domains);
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
				})
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
					{version: 'v3', rule:'*'}
				]
			}
		};

		var updatedRules = [
			{version: 'v1', rule:'random:0.5'},
			{version: 'v10', rule:'random:0.5'}
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
					assert.deepEqual(app.trafficRules.test, [{version:'v3', rule:'*'}]);
					assert.deepEqual(app.trafficRules.production, updatedRules);
					cb();
				});
			}
		], done);
	});

	describe('env', function() {
		beforeEach(function() {
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
			var self = this;
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

						assert.equal(app.env[self.envName][key], value);
						cb();
					});
				}
			], done);
		});

		it('new variable for existing environment', function(done) {
			var self = this;
			var key = 'KEY', value='value';

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

						assert.equal(app.env[self.envName][key], value);
						cb();
					});
				}
			], done);
		});

		it('update existing env variable', function(done) {
			var self = this;
			var key = 'KEY', value='value';

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

						assert.equal(app.env[self.envName][key], value);
						cb();
					});
				}
			], done);
		});

		it('encrypted env variable', function(done) {
			var self = this;

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
					dynamo.models.Application.get(self.appData.appId, function(err, app) {
						if (err) return cb(err);

						assert.ok(/^__ENCRYPTED__/.test(app.attrs.env[self.envName][key]));
						cb();
					})
				},
				function(cb) {
					dynamo.getApplication(self.appData.appId, function(err, app) {
						if (err) return cb(err);

						assert.equal(app.env[self.envName][key], value);
						cb();
					});
				}
			], done);
		});
	});
});
