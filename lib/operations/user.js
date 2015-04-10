var debug = require('debug')('4front:dynamodb');
var _ = require('lodash');
var async = require('async');

module.exports = function(DynamoDb) {

  // Find the user by the provider Id and provider name, i.e. GitHub or BitBucket
  DynamoDb.prototype.findUser = function(providerUserId, provider, callback) {
    var self = this;
    debug("find user %s for provider %s", providerUserId, provider);
    this.models.User.query(providerUserId.toString())
      .usingIndex("providerUserIndex")
      .where("provider")
      .equals(provider)
      .exec(this._itemCallback(callback));
  }

  DynamoDb.prototype.createUser = function(userData, callback) {
    debug("create user " + userData.userId);
    this.models.User.create(userData, this._itemCallback(callback));
  };

  DynamoDb.prototype.updateUser = function(userData, callback) {
    this.models.User.update(userData, this._itemCallback(callback));
  };

  DynamoDb.prototype.getUser = function(userId, callback) {
    this.models.User.get(userId, this._itemCallback(callback));
  };

  DynamoDb.prototype.getUserInfo = function(userIds, callback) {
    debug("get info for users %s", JSON.stringify(userIds));
    var attrs = ['username', 'avatar', 'providerUserId', 'provider'];
    this.models.User.getItems(userIds, {AttributesToGet: ['userId'].concat(attrs)}, function(err, data) {
      if (err) return callback(err);

      var userInfoMap = {};
      _.each(data, function(user) {
        userInfoMap[user.attrs.userId] = _.pick(user.attrs, attrs);
      });

      callback(null, userInfoMap);
    });
  };

  DynamoDb.prototype.deleteUser = function(userId, callback) {
    var self = this;
    async.parallel([
      function(cb) {
        self.models.User.destroy(userId, cb);
      },
      function(cb) {
        self.models.OrgMember.query(userId).exec(function(err, data) {
          if (err) return cb(err);

          debug("deleting " + data.Items.length + " orgMember associations");
          async.each(data.Items, function(orgMember, cb1) {
            self.OrgMember.destroy(orgMember.orgId, userId, cb1);
          }, cb);
        });
      }
    ], callback);
  };

  DynamoDb.prototype.listUserOrgs = function(userId, callback) {
    var self = this;
    debug("list orgs for user " + userId);

    self.models.OrgMember
      .query(userId)
      .usingIndex('userIdIndex')
      .exec(function(err, data) {
        if (err) return callback(err);

        var userOrgs = _.map(data.Items, 'attrs');
        debug("found %s orgs user %s is a member of", userOrgs.length, userId);

        self.models.Organization.getItems(_.map(userOrgs, 'orgId'), function(err, data) {
          if (err) return callback(err);

          var orgs = _.reject(_.map(data, 'attrs'), {terminated: true});

          // Overlay the orgMember info onto the org itself
          _.each(orgs, function(org) {
            var orgMember = _.find(userOrgs, {orgId: org.orgId});
            _.extend(org, {role: orgMember.role});
          });
          callback(null, orgs);
        });
    });
  };
};
