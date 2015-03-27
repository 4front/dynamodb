var AWS = require('aws-sdk');
var _ = require('lodash');
var async = require('async');
var shortid = require('shortid');
var assert = require('assert');
var DynamoDb = require('../lib/dynamo');


describe('Version', function() {
	var dynamo;
	before(function() {
		dynamo = new DynamoDb({ 
		  region: 'us-west-2',
		  endpoint: 'http://localhost:8000'
		});
	});

	beforeEach(function() {
		this.versionDefaults = {
			appId: shortid.generate(),
			userId: shortid.generate(),
			versionNum: 1,
			name: 'v1',
			message: 'deployment message',
			deployments: {
				prod: 1
			}
		};
	});

	it('create version', function(done) {
		var versionData = {
			versionId: shortid.generate(),
			versionNum: 1,
			name: 'v1',
			userId: shortid.generate(),
			appId: shortid.generate(),
			deployments: {
				prod: 1,
				test: .5
			}
		};

		async.series([
			function(cb) {
				dynamo.createVersion(versionData, function(err, version) {
					if (err) return cb(err);
					assert.equal(version.versionId, versionData.versionId);
					cb();
				});
			},
			function(cb) {
				dynamo.getVersion(versionData.versionId, function(err, version) {
					if (err) return cb(err);

					console.log(JSON.stringify(version));
					assert.ok(_.isEqual(_.omit(version, 'created'), versionData));
					cb();
				});
			}
		], done);
	});

	it('find all versions deployed to an environment', function(done) {
		var self = this;

		// Create 3 versions, two of which are deployed to "prod" environment
		var versionData = _.map(['prod', 'test', 'prod'], function(env, i) {
			var v = _.extend({}, self.versionDefaults, {
				versionId: shortid.generate(), 
				versionNum: i + 1,
				deployments: {}
			});

			v.deployments[env] = 1;
			return v;
		});

		async.each(versionData, function(data, cb) {
			dynamo.createVersion(data, cb);
		}, function(err) {
			if (err) return done(err);

			dynamo.versionsDeployedToEnv(self.versionDefaults.appId, 'prod', function(err, versions) {
				if (err) return done(err);

				assert.equal(2, versions.length);
				done();
			});
		});
	});
});