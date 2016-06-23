var async = require('async');
var dateformat = require('dateformat');
var _ = require('lodash');
var debug = require('debug')('4front:dynamodb');

require('simple-errors');

module.exports = function(DynamoDb) {
  DynamoDb.prototype.getOrganization = function(orgId, callback) {
    debug('get organization %s', orgId);
    this.models.Organization.get(orgId, this._itemCallback(callback));
  };

  // Organization related functions
  DynamoDb.prototype.createOrganization = function(orgData, callback) {
    debug('creating organization: %s', orgData.name);
    this.models.Organization.create(orgData, this._itemCallback(callback));
  };

  DynamoDb.prototype.updateOrganization = function(orgData, callback) {
    this.models.Organization.update(orgData, this._itemCallback(callback));
  };

  DynamoDb.prototype.deleteOrganization = function(orgId, callback) {
    this.models.Organization.destroy(orgId, callback);
  };

  // List the apps by organization
  DynamoDb.prototype.listOrgApplications = function(orgId, callback) {
    var self = this;
    debug('list applications for org %s', orgId);
    async.waterfall([
      function(cb) {
        self.models.Application.query(orgId)
          .usingIndex('orgIdIndex2')
          .exec(self._listCallback(cb));
      },
      function(apps, cb) {
        // Get the appName for each app.
        async.each(apps, function(app, next) {
          self._getAppName(app.appId, function(_err, name) {
            if (_err) return next(_err);
            app.name = name;
            next();
          });
        }, function(err) {
          if (err) return cb(err);
          cb(null, apps);
        });
      }
    ], callback);
  };

  DynamoDb.prototype.getOrgMember = function(orgId, userId, callback) {
    debug('get orgMember orgId: %s, userId: %s', orgId, userId);
    this.models.OrgMember.get(orgId, userId, this._itemCallback(callback));
  };

  DynamoDb.prototype.listOrgMembers = function(orgId, callback) {
    debug('list members of org %s', orgId);
    this.models.OrgMember.query(orgId).exec(this._listCallback(callback));
  };

  DynamoDb.prototype.createOrgMember = function(orgMemberData, callback) {
    debug('adding user %s to org %s', orgMemberData.userId, orgMemberData.orgId);
    this.models.OrgMember.create(orgMemberData, this._itemCallback(callback));
  };

  DynamoDb.prototype.updateOrgMember = function(orgMemberData, callback) {
    this.models.OrgMember.update(orgMemberData, this._itemCallback(callback));
  };

  // Delete all members of the org
  DynamoDb.prototype.deleteOrgMembers = function(orgId, callback) {
    debug('Deleting org %s', orgId);
    var self = this;

    this.models.OrgMember.query(orgId)
      .projectionExpression('userId')
      .exec(function(err, data) {
        if (err) return callback(err);

        async.each(data.Items, function(item, cb) {
          self.models.OrgMember.destroy({
            userId: item.attrs.userId,
            orgId: orgId
          }, cb);
        }, callback);
      });
  };

  DynamoDb.prototype.incrementDailyOperations = function(orgId, appId, operation, callback) {
    debug('incrementing operation %s for appId %s', operation, appId);

    var params = {
      // Increment both the overall operation count for this app for the current date as well
      // as the count for the specific operation
      UpdateExpression: 'ADD #operation :increment, #total :increment',
      ExpressionAttributeNames: {
        // "#dailyOperationCount": "counts." + moment().format('MM-DD') + '.' + operation,
        '#operation': 'op_' + operation,
        '#total': 'total'
      },
      ExpressionAttributeValues: {':increment': 1}
    };

    var date = dateformat(Date.now(), 'YYYY-MM-DD');
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
            if (attr.slice(0, 3) === 'op_') {
              row.operationCounts[attr.slice(3)] = value;
            }
          });

          results.push(row);
        });

        callback(null, results);
      });
  };

  DynamoDb.prototype.deleteOrgMember = function(orgId, userId, callback) {
    debug('deleting org member orgId: %s, userId: %s', orgId, userId);
    this.models.OrgMember.destroy(orgId, userId, callback);
  };
};
