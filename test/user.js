var assert = require('assert');
var async = require('async');
var shortid = require('shortid');
var _ = require('lodash');
var helper = require('./helper');

describe('User', function() {
  var dynamo = helper.newLocalDynamo();

  beforeEach(function() {
    var userId = shortid.generate();
    this.userDefaults = {
      userId: userId,
      providerUserId: userId,
      username: 'user-' + userId,
      provider: 'github',
      email: userId + '@test.com',
      secretKey: shortid.generate()
    }
  });

  it('create, retrieves and updates user', function(done) {
    var self = this;
    async.waterfall([
      function(cb) {
        dynamo.createUser(self.userDefaults, cb);
      },
      function(user, cb) {
        dynamo.getUser(user.userId, function(err, retrievedUser) {
          assert.ok(_.isEqual(_.pick(retrievedUser, _.keys(self.userDefaults)), self.userDefaults));
          cb(null, retrievedUser);
        });
      },
      function(user, cb) {
        dynamo.updateUser(_.extend(self.userDefaults, {email: user.userId + '2@test.com'}), cb);
      },
      function(user, cb) {
        dynamo.getUser(user.userId, function(err, retrievedUser) {
          assert.equal(retrievedUser.email, user.userId + '2@test.com');
          cb(null, retrievedUser);
        });
      },
      function(user, cb) {
        dynamo.deleteUser(user.userId, cb);
      }
    ], done);
  });

  it('find user by provider id', function(done) {
    var self = this;
    async.series([
      function(cb) {
        dynamo.createUser(self.userDefaults, cb);
      },
      function(cb) {
        dynamo.findUser(self.userDefaults.providerUserId, 'github', function(err, user) {
          if (err) return cb(err);
          debugger;
          assert.equal(user.username, 'user-' + self.userDefaults.userId);
          cb();
        });
      }
    ], done)
  });

  it('getUserInfo', function(done) {
    var self = this;

    var users = _.times(3, function(i) {
      return _.extend({}, self.userDefaults, {
        userId: shortid.generate()
      });
    });

    async.each(users, function(user, cb) {
      dynamo.createUser(user, cb);
    }, function(err) {
      if (err) return done(err);

      var userIds = _.map(users, 'userId');
      dynamo.getUserInfo(userIds, function(err, retrievedUsers) {
        assert.equal(3, _.keys(retrievedUsers).length);
        assert.noDifferences(_.keys(retrievedUsers), userIds);
        done();
      });
    });
  });

  it('get user orgs', function(done) {
    var self = this;
    // Add the user to some orgs
    var orgIds = _.times(3, function() {
      return shortid.generate();
    });

    async.each(orgIds, function(orgId, cb) {
      async.parallel([
        function(cb1) {
          dynamo.createOrganization({
            orgId: orgId,
            name: 'org-' + orgId,
            ownerId: shortid.generate(),
            terminated: orgId == orgIds[1]
          }, cb);
        },
        function(cb1) {
          dynamo.createOrgMember({
            orgId: orgId,
            userId: self.userDefaults.userId,
            role:'contributor'
          }, cb1);
        }
      ], cb);
    }, function(err) {
      if (err) return done(err);

      dynamo.listUserOrgs(self.userDefaults.userId, function(err, orgs) {
        // Should get back two orgs since the terminated one is filtered out
        assert.equal(2, orgs.length);
        assert.noDifferences([orgIds[0], orgIds[2]], _.map(orgs, 'orgId'));
        done();
      });
    });
  });
});
