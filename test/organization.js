var _ = require('lodash');
var async = require('async');
var shortid = require('shortid');
var assert = require('assert');
var DynamoDb = require('../lib/dynamo');

describe('Organization', function() {
	var self;
	var dynamo = new DynamoDb({
	  region: 'us-west-2',
	  endpoint: 'http://localhost:8000'
	});

	beforeEach(function() {
		self = this;
		this.orgData = {
			orgId: shortid.generate(),
			ownerId: shortid.generate(),
			name: 'org-name'
    };
	});

	it('create and retrieve organization', function(done) {
    async.series([
      function(cb) {
        dynamo.createOrganization(self.orgData, cb);
      },
      function(cb) {
        dynamo.getOrganization(self.orgData.orgId, function(err, org) {
          if (err) return cb(err);
          assert.ok(_.isEqual(self.orgData, _.pick(org, _.keys(self.orgData))));
          cb();
        });
      },
      function(cb) {
        self.orgData.name = "new-name";
        dynamo.updateOrganization(self.orgData, cb);
      },
      function(cb) {
        dynamo.getOrganization(self.orgData.orgId, function(err, org) {
          if (err) return cb(err);
          assert.equal(org.name, "new-name");
          cb();
        });
      }
    ], done);
	});

  it('create and list org members', function(done) {
    var userIds = _.times(3, function() { return shortid.generate(); });

    async.series([
      function(cb) {
        dynamo.createOrganization(self.orgData, cb);
      },
      function(cb) {
        // Add org members
        async.each(userIds, function(userId, cb1) {
          dynamo.createOrgMember({
            orgId: self.orgData.orgId,
            userId: userId,
            role: 'admin'
          }, cb1);
        }, cb);
      },
      function(cb) {
        dynamo.listOrgMembers(self.orgData.orgId, function(err, members) {
          if (err) return cb(err);
          assert.equal(3, members.length);
          assert.equal(0, _.difference(_.map(members, 'userId'), userIds).length);
          cb();
        });
      }
    ], done);
  });

  it('update org member', function(done) {
    var userId = shortid.generate();
    async.series([
      function(cb) {
        dynamo.createOrganization(self.orgData, cb);
      },
      function(cb) {
        // Add org members
        dynamo.createOrgMember({
          userId: userId,
          orgId: self.orgData.orgId,
          role: 'contributor'
        }, cb);
      },
      function(cb) {
        dynamo.updateOrgMember({
          userId: userId,
          orgId: self.orgData.orgId,
          role: 'admin'
        }, cb);
      },
      function(cb) {
        dynamo.getOrgMember(self.orgData.orgId, userId, function(err, member) {
          if (err) return cb(err);

          assert.equal('admin', member.role);
          cb();
        });
      },
      function(cb) {
        dynamo.deleteOrgMember(self.orgData.orgId, userId, cb);
      },
      function(cb) {
        dynamo.getOrgMember(self.orgData.orgId, userId, function(err, member) {
          if (err) return cb(err);
          assert.ok(member == null);
          cb();
        });
      }
    ], done);
  });
});
