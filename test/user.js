var async = require('async');
var _ = require('lodash');
var debug = require('debug')('4front:dynamo');

require('simple-errors');

module.exports = function(DynamoDb) {
  // Find the user by the provider Id and provider name, i.e. GitHub or BitBucket
  DynamoDb.prototype.findUser = function(providerUserId, provider, callback) {
    var self = this;
    debug("Find user " + providerUserId + ", " + provider);
    this.models.User.query(providerUserId.toString())
      .usingIndex("providerUserIndex")
      .where("provider")
      .equals(provider)
      .exec(this._itemCallback(callback));
  };

  DynamoDb.prototype.createUser = function(userData, callback) {
    debug("Create user " + userData.userId);
    this.User.create(userData, this._itemCallback(callback));
  };

  DynamoDb.prototype.updateUser = function(userData, callback) {
    this.User.update(userData, this._itemCallback(callback));
  };

  DynamoDb.prototype.getUser = function(userId, callback) {
    this.User.get(userId, this._itemCallback(callback));
  };

  DynamoDb.prototype.listUserOrgs = function(userId, callback) {
    var self = this;
    debug("List orgs for user " + userId);

    this.models.OrgMember
      .query(userId)
      .usingIndex('userIdIndex')
      .exec(function(err, data) {
        if (err) return callback(err);

        var userOrgs = _.map(data.Items, 'attrs');
        debug("Found %s orgs user %s is a member of", userOrgs.length, userId);

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
