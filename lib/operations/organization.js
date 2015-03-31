var async = require('async');
var _ = require('lodash');
var debug = require('debug')('4front:dynamo');

require('simple-errors');

module.exports = function(DynamoDb) {
  // Organization related functions
  DynamoDb.prototype.createOrganization = function(orgData, callback) {
    debug("Creating organization " + orgData.orgId);
    this.models.Organization.create(orgData, this._itemCallback(callback));
  };

  DynamoDb.prototype.getOrganization = function(orgId, callback) {
    this.models.Organization.get(orgId, this._itemCallback(callback));
  };

  DynamoDb.prototype.updateOrganization = function(orgData, callback) {
    this.models.Organization.update(orgData, this._itemCallback(callback));
  };

  DynamoDb.prototype.getOrgMember = function(orgId, userId, callback) {
    debug("Get orgMember orgId: " + orgId + ", userId: " + userId);
    this.models.OrgMember.get(orgId, userId, this._itemCallback(callback));
  };

  DynamoDb.prototype.listOrgMembers = function(orgId, callback) {
    debug("List members of org " + orgId);
    this.models.OrgMember.query(orgId).exec(this._listCallback(callback));
  };

  DynamoDb.prototype.createOrgMember = function(orgMemberData, callback) {
    debug("Adding user " + orgMemberData.userId + " to org " + orgMemberData.orgId);
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
    debug("Deleting org member user: " + userId + " orgId: " + orgId);
    this.models.OrgMember.destroy({userId: userId, orgId: orgId}, callback);
  };
};
