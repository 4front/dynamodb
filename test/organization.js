var _ = require('lodash');
var async = require('async');
var shortid = require('shortid');
var assert = require('assert');

require('dash-assert');

describe('Organization', function() {
  var self;
  var dynamo = require('./dynamo-local');

  beforeEach(function() {
    self = this;
    this.orgData = {
      orgId: shortid.generate(),
      ownerId: shortid.generate(),
      name: 'org-name'
    };
  });

  it('create and update organization', function(done) {
    self = this;
    async.waterfall([
      function(cb) {
        dynamo.createOrganization(self.orgData, cb);
      },
      function(newOrg, cb) {
        dynamo.getOrganization(newOrg.orgId, function(err, org) {
          if (err) return cb(err);
          assert.ok(_.isEqual(_.pick(org, _.keys(self.orgData)), self.orgData));
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

  it('lists organization websites', function(done) {
    var orgId = shortid.generate();
    var appDataArray = _.times(3, function() {
      var appId = shortid.generate();
      return {
        appId: appId,
        ownerId: shortid.generate(),
        orgId: orgId,
        name: 'app-' + appId
      };
    });

    async.series([
      function(cb) {
        async.each(appDataArray, function(appData, cb1) {
          dynamo.createApplication(appData, cb1);
        }, cb);
      },
      function(cb) {
        dynamo.listOrgApplications(orgId, function(err, orgApps) {
          if (err) return cb(err);
          assert.equal(orgApps.length, 3);
          assert.noDifferences(_.map(appDataArray, 'appId'), _.map(orgApps, 'appId'));
          assert.noDifferences(_.map(appDataArray, 'name'), _.map(orgApps, 'name'));
          cb();
        });
      },
      function(cb) {
        dynamo.countOrgApplications(orgId, function(err, count) {
          if (err) return cb(err);
          assert.equal(3, count);
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
          assert.noDifferences(userIds, _.map(members, 'userId'));
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
          assert.ok(member === null);
          cb();
        });
      }
    ], done);
  });

  it('org members', function(done) {
    self = this;
    var userIds = _.times(2, function() {
      return shortid.generate();
    });

    async.series([
      function(cb) {
        dynamo.createOrganization(self.orgData, cb);
      },
      function(cb) {
        dynamo.createOrgMember({orgId: self.orgData.orgId, userId: userIds[0], role: 'admin'}, cb);
      },
      function(cb) {
        dynamo.createOrgMember({orgId: self.orgData.orgId,
          userId: userIds[1], role: 'contributor'}, cb);
      },
      function(cb) {
        dynamo.listOrgMembers(self.orgData.orgId, function(err, members) {
          assert.equal(2, members.length);
          cb();
        });
      },
      function(cb) {
        dynamo.getOrgMember(self.orgData.orgId, userIds[0], function(err, orgMember) {
          assert.equal(orgMember.role, 'admin');
          cb();
        });
      },
      function(cb) {
        dynamo.deleteOrgMember(self.orgData.orgId, userIds[1], cb);
      },
      function(cb) {
        dynamo.getOrgMember(self.orgData.orgId, userIds[1], function(err, member) {
          assert.isNull(member);
          cb();
        });
      },
      function(cb) {
        dynamo.deleteOrgMembers(self.orgData.orgId, cb);
      },
      function(cb) {
        dynamo.listOrgMembers(self.orgData.orgId, function(err, members) {
          if (err) return cb(err);

          assert.equal(members.length, 0);
          cb();
        });
      }
    ], done);
  });

  it('deletes organization', function(done) {
    async.series([
      function(cb) {
        dynamo.createOrganization(self.orgData, cb);
      },
      function(cb) {
        dynamo.createOrgMember({orgId: self.orgData.orgId,
          userId: shortid.generate(), role: 'admin'}, cb);
      },
      function(cb) {
        dynamo.deleteOrganization(self.orgData.orgId, cb);
      },
      function(cb) {
        dynamo.getOrganization(self.orgData.orgId, function(err, org) {
          if (err) return cb(err);
          assert.isNull(org);
          cb();
        });
      }
    ], done);
  });
});
