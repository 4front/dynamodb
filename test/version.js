var AWS = require('aws-sdk');
var _ = require('lodash');
var async = require('async');
var shortid = require('shortid');
var assert = require('assert');
var helper = require('./helper');

describe('Version', function() {
	var dynamo = helper.newLocalDynamo();

	beforeEach(function() {
		this.versionDefaults = {
			versionId: shortid.generate(),
			appId: shortid.generate(),
			userId: shortid.generate(),
			versionNum: 1,
			name: 'v1',
			message: 'deployment message'
		};
	});

	it('create version', function(done) {
		var self = this;

		async.series([
			function(cb) {
				dynamo.createVersion(self.versionDefaults, function(err, version) {
					if (err) return cb(err);
					assert.equal(version.versionId, self.versionDefaults.versionId);
					cb();
				});
			},
			function(cb) {
				dynamo.getVersion(self.versionDefaults.versionId, function(err, version) {
					if (err) return cb(err);

					assert.ok(_.isEqual(_.omit(version, 'created'), self.versionDefaults));
					cb();
				});
			}
		], done);
	});

	it('lists versions', function(done) {
		var self = this;

		// Create 3 versions, two of which are deployed to "prod" environment
		var versionData = _.times(3, function(i) {
			return _.extend({}, self.versionDefaults, {
				versionId: shortid.generate(),
				versionNum: i + 1
			});
		});

		async.each(versionData, function(data, cb) {
			dynamo.createVersion(data, cb);
		}, function(err) {
			if (err) return done(err);

			dynamo.listVersions({appId: self.versionDefaults.appId, limit: 20}, function(err, versions) {
				if (err) return done(err);

				assert.equal(3, versions.length);
				done();
			});
		});
	});

	it('find all versions in an environment', function(done) {
		var self = this;

		// Create 3 versions, two of which are deployed to "prod" environment
		var versionData = _.map(['prod', 'test', 'prod'], function(env, i) {
			return _.extend({}, self.versionDefaults, {
				versionId: shortid.generate(),
				versionNum: i + 1,
				environments: [env]
			});
		});

		async.each(versionData, function(data, cb) {
			dynamo.createVersion(data, cb);
		}, function(err) {
			if (err) return done(err);

			dynamo.listVersions({appId: self.versionDefaults.appId, env: 'prod'}, function(err, versions) {
				if (err) return done(err);

				assert.equal(2, versions.length);
				done();
			});
		});
	});

	it('gets next version num', function(done) {
		var self = this;
		var appId = shortid.generate();
		async.series([
			function(cb) {
				dynamo.nextVersionNum(appId, function(err, versionNum) {
					assert.equal(1, versionNum);
					cb();
				})
			},
			function(cb) {
				dynamo.createVersion(_.extend(self.versionDefaults, {appId: appId, versionNum: 1}), cb);
			},
			function(cb) {
				dynamo.nextVersionNum(appId, function(err, versionNum) {
					assert.equal(2, versionNum);
					cb();
				});
			}
		], done);
	});
});
