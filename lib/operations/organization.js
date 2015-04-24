var async = require('async');
var moment = require('moment');
var _ = require('lodash');
var debug = require('debug')('4front:dynamodb');

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

  DynamoDb.prototype.listOrgAppIds = function(orgId, callback) {
    this.models.Application.query(orgId)
      .usingIndex('orgIdIndex')
      .attributes(['appId'])
      .exec(function(err, data) {
        if (err) return callback(err);

        callback(null, _.map(data.Items, function(item) {
          return item.attrs.appId;
        }));
      });
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

  DynamoDb.prototype.incrementDailyOperations = function(orgId, appId, operation, callback) {
    debug("incrementing operation %s for appId %s", operation, appId);

    var params = {
      // Increment both the overall operation count for this app for the current date as well
      // as the count for the specific operation
			UpdateExpression: "ADD #operation :increment, #total :increment",
			ExpressionAttributeNames: {
        // "#dailyOperationCount": "counts." + moment().format('MM-DD') + '.' + operation,
        "#operation": "op_" + operation,
        "#total": "total"
      },
			ExpressionAttributeValues: {":increment": 1 }
		};

    var date = moment().format('YYYY-MM-DD');
    this.models.DailyOperations.update({
      orgId: orgId,
      dateAppId: date + '_' + appId,
      date: date
    }, params, this._itemCallback(callback));
  };

  DynamoDb.prototype.getDailyOperationsByOrg = function(orgId, startDate, endDate, callback) {
    this.models.DailyOperations.query(orgId)
      .where('dateAppId').between(startDate, endDate + '_ZZZZZZZZZZZ')
      .exec(function(err, data) {
        if (err) return callback(err);

        var results = [];
        _.each(data.Items, function(item) {
          var row = {
            orgId: item.attrs.orgId,
            date: item.attrs.date,
            total: item.attrs.total,
            operationCounts: {}
          };

          _.each(item.attrs, function(value, attr) {
            if (attr.slice(0, 3) === 'op_')
              row.operationCounts[attr.slice(3)] = value;
          });

          results.push(row);
        });

        callback(null, results);
      });
  };

  DynamoDb.prototype.deleteOrgMember = function(orgId, userId, callback) {
    debug("deleting org member orgId: %s, userId: %s", orgId, userId);
    this.models.OrgMember.destroy(orgId, userId, callback);
  };
};
