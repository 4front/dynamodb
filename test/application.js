var AWS = require('aws-sdk');
var _ = require('lodash');
var async = require('async');
var shortid = require('shortid');
var assert = require('assert');
var DynamoDb = require('../lib/dynamo');

describe('Application', function() {
	var dynamo = new DynamoDb({ 
	  region: 'us-west-2',
	  endpoint: 'http://localhost:8000'
	});

	beforeEach(function() {
		this.appData = {
			appId: shortid.generate(),
			orgId: shortid.generate(),
			ownerId: shortid.generate(),
			name: 'app-name-' + shortid.generate(),
			deployedVersions: {
				prod: {
					'v1': .5,
					'v2': .5
				},
				test: {
					'v3': 1
				}
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

					assert.ok(_.isEqual(appData, _.pick(app, _.keys(appData))));
					cb();
				});
			},
			function(cb) {
				dynamo.getApplication(appData.appId, function(err, app) {
					if (err) return cb(err);

					assert.ok(_.isEqual(appData, _.pick(app, _.keys(appData))));
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
					done();
				});
			}
		]);
	});

	it('updates deployed versions', function(done) {
		var appData = this.appData;

		async.series([
			function(cb) {
				dynamo.createApplication(appData, cb);
			},
			function(cb) {
				// direct all prod traffic to v10
				dynamo.updateDeployedVersions(appData.appId, 'prod', {'v10': 1}, cb);
			},
			function(cb) {
				dynamo.getApplication(appData.appId, function(err, app) {
					if (err) return cb(err);

					assert.ok(_.isEqual(app.deployedVersions.test, {'v3': 1}));
					assert.ok(_.isEqual(app.deployedVersions.prod, {'v10': 1}));
					cb();
				});
			}
		], done);
	});
});