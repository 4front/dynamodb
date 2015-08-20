var AWS = require('aws-sdk');
var _ = require('lodash');
var async = require('async');
var shortid = require('shortid');
var assert = require('assert');
var debug = require('debug')('4front:dynamo:version:test')

require('dash-assert');

describe('Version', function() {
	var self;
	var dynamo = require('./dynamo-local');

	beforeEach(function() {
		self = this;

		this.versionDefaults = {
			versionId: shortid.generate(),
			appId: shortid.generate(),
			userId: shortid.generate(),
			versionNum: 1,
			name: 'v1',
			status: 'initiated',
			message: 'deployment message',
			manifest: {}
		};
	});

	it('create version', function(done) {
		async.series([
			function(cb) {
				dynamo.createVersion(self.versionDefaults, function(err, version) {
					if (err) debug("error creating version");
					if (err) return cb(err);
					assert.equal(version.versionId, self.versionDefaults.versionId);
					cb();
				});
			},
			function(cb) {
				dynamo.getVersion(self.versionDefaults.appId, self.versionDefaults.versionId, function(err, version) {
					if (err) debug("error getting version");
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
			dynamo.createVersion(data, cb);
		}, function(err) {
			if (err) return done(err);

			dynamo.listVersions(self.versionDefaults.appId, {}, function(_err, versions) {
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

	it('updates version', function(done) {
		var appId = shortid.generate();
		var versionData = _.extend(this.versionDefaults, {appId: appId, versionNum: 1});

		async.series([
			function(cb) {
				dynamo.createVersion(versionData, cb);
			},
			function(cb) {
				_.extend(versionData, {
					name: 'new name',
					message: 'new message'
				});

				dynamo.updateVersion(versionData, cb);
			},
			function(cb) {
				dynamo.getVersion(versionData.appId, versionData.versionId, function(err, version) {
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
			dynamo.createVersion(data, cb);
		}, function(err) {
			if (err) return done(err);

			dynamo.getVersionCount(self.versionDefaults.appId, function(_err, count) {
				if (_err) return done(_err);

				assert.equal(4, count);
				done();
			});
		});
	});
});
