var async = require('async');
var _ = require('lodash');
var debug = require('debug')('4front:dynamo');

require('simple-errors');

module.exports = function(DynamoDb) {
  DynamoDb.prototype.getOrganization = function(orgId, callback) {
    this.models.Organization.get(orgId, this._itemCallback(callback));
  };

  // Organization related functions
  DynamoDb.prototype.createOrganization = function(orgData, callback) {
    debug("creating organization: %s", orgData.name);
    this.models.Organization.create(orgData, this._itemCallback(callback));
  };

  DynamoDb.prototype.updateOrganization = function(orgData, callback) {
    this.models.Organization.update(orgData, this._itemCallback(callback));
  };

  DynamoDb.prototype.getOrgMember = function(orgId, userId, callback) {
    debug("get orgMember orgId: %s, userId: %s", orgId, userId);
    this.models.OrgMember.get(orgId, userId, this._itemCallback(callback));
  };

  DynamoDb.prototype.listOrgMembers = function(orgId, callback) {
    debug("list members of org %s", orgId);
    this.models.OrgMember.query(orgId).exec(this._listCallback(callback));
  };

  DynamoDb.prototype.createOrgMember = function(orgMemberData, callback) {
    debug("adding user %s to org %s", orgMemberData.userId, orgMemberData.orgId);
    this.models.OrgMember.create(orgMemberData, this._itemCallback(callback));
  };

  DynamoDb.prototype.updateOrgMember = function(orgMemberData, callback) {
    this.models.OrgMember.update(orgMemberData, this._itemCallback(callback));
  };

  // Delete all members of the org
  DynamoDb.prototype.deleteOrgMembers = function(orgId, callback) {
    debug("Deleting org %s", orgId);
    var self = this;

    this.models.OrgMember.query(orgId)
      .attributes(['userId'])
      .exec(function(err, data) {
        if (err) return callback(err);

        async.each(data.Items, function(item, cb) {
          self.OrgMember.destroy({userId: item.attrs.userId, orgId:orgId}, cb);
        }, callback);
      });
  };

  DynamoDb.prototype.deleteOrgMember = function(orgId, userId, callback) {
    debug("deleting org member orgId: %s, userId: %s", orgId, userId);
    this.models.OrgMember.destroy(orgId, userId, callback);
  };
};
