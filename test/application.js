var _ = require('lodash');
var async = require('async');
var shortid = require('shortid');
var assert = require('assert');
var helper = require('./helper');

describe('Application', function() {
	var dynamo = helper.newLocalDynamo();

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
					assert.equal(_.difference(app.domains, updatedData.domains).length, 0);
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

	it('list org applications', function(done) {
		var appIds = _.times(3, function() {
			return shortid.generate();
		});

		async.series([
			function(cb) {
				async.each(appIds, function(appId, cb1) {
					dynamo.createApplication(_.extend({}, self.appData, {
						appId: appId,
						name: 'app-' + appId
					}), cb1);
				}, cb);
			},
			function(cb) {
				dynamo.orgApplications(self.appData.orgId, function(err, orgAppIds) {
					assert.equal(orgAppIds.length, 3);
					assert.equal(_.difference(appIds, orgAppIds).length, 0);
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
				production: [
					{version: 'v1', rule:'random:0.5'},
					{version: 'v3', rule:'random:0.5'}
				],
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
});
