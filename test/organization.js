var assert = require('assert');
var async = require('async');
var shortid = require('shortid');
var _ = require('lodash');
var helper = require('./helper');

describe('Organization', function() {
  var dynamo = helper.newLocalDynamo();

  beforeEach(function() {
    this.orgDefaults = {
      orgId: shortid.generate(),
      name: 'test org',
      ownerId: shortid.generate()
    };
  });

  it('create and update organization', function(done) {
    var self = this;
    async.waterfall([
      function(cb) {
        dynamo.createOrganization(self.orgDefaults, cb);
      },
      function(newOrg, cb) {
        dynamo.getOrganization(newOrg.orgId, function(err, org) {
          if (err) return cb(err);
          assert.ok(_.isEqual(_.pick(org, _.keys(self.orgDefaults)), self.orgDefaults));
          cb(null, org);
        });
      },
      function(org, cb) {
        org.name = 'updated name';
        dynamo.updateOrganization(org, cb);
      },
      function(org, cb) {
        dynamo.getOrganization(org.orgId, function(err, retrievedOrg) {
          assert.equal(retrievedOrg.name, 'updated name');
          cb();
        });
      }
    ], done);
  });

  it('org members', function(done) {
    var self = this;
    var userIds = _.times(2, function() {
      return shortid.generate();
    });

    async.series([
      function(cb) {
        dynamo.createOrganization(self.orgDefaults, cb);
      },
      function(cb) {
        dynamo.createOrgMember({orgId: self.orgDefaults.orgId, userId: userIds[0], role: 'admin'}, cb);
      },
      function(cb) {
        dynamo.createOrgMember({orgId: self.orgDefaults.orgId, userId: userIds[1], role: 'contributor'}, cb);
      },
      function(cb) {
        dynamo.listOrgMembers(self.orgDefaults.orgId, function(err, members) {
          assert.equal(2, members.length);
          cb();
        });
      },
      function(cb) {
        dynamo.getOrgMember(self.orgDefaults.orgId, userIds[0], function(err, orgMember) {
          assert.equal(orgMember.role, 'admin');
          cb();
        })
      },
      function(cb) {
        dynamo.deleteOrgMember(self.orgDefaults.orgId, userIds[1], cb);
      },
      function(cb) {
        dynamo.getOrgMember(self.orgDefaults.orgId, userIds[1], function(err, member) {
          assert.ok(_.isNull(member));
          cb();
        })
      }
    ], done);
  });
});
