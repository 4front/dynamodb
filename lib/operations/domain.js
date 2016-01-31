var _ = require('lodash');
var async = require('async');
var debug = require('debug')('4front:dynamodb');

require('simple-errors');

module.exports = function(DynamoDb) {
  DynamoDb.prototype.getLegacyDomain = function(fullDomainName, callback) {
    this.models.LegacyDomain.get(fullDomainName, this._itemCallback(callback));
  };

  DynamoDb.prototype.listLegacyDomains = function(orgId, callback) {
    this.models.LegacyDomain.query(orgId)
      .usingIndex('orgIdIndex')
      .exec(this._listCallback(callback));
  };

  DynamoDb.prototype.createDomain = function(domainData, callback) {
    // Perform a conditional write to avoid collisions with existing domains
    var params = {
      ConditionExpression: '#domainName <> :domainName',
      ExpressionAttributeNames: {'#domainName': 'domainName'},
      ExpressionAttributeValues: {':domainName': domainData.domainName}
    };

    debug('create domain %s', domainData.domainName);
    this.models.Domain.create(domainData, params, function(err, domain) {
      if (err) return maybeDomainTakenError(err, domainData.domain, callback);

      callback(null, domain);
    });
  };

  DynamoDb.prototype.getDomain = function(domainName, callback) {
    this.models.Domain.get(domainName, this._itemCallback(callback));
  };

  DynamoDb.prototype.listDomains = function(orgId, callback) {
    this.models.Domain.query(orgId)
      .usingIndex('orgIdIndex')
      .exec(this._listCallback(callback));
  };

  DynamoDb.prototype.deleteDomain = function(orgId, domainName, callback) {
    var self = this;
    // Perform a conditional write to avoid collisions with existing domains
    async.waterfall([
      function(cb) {
        self.models.Domain.destroy(domainName, self._orgIdCondition(orgId), function(err) {
          if (err) {
            return maybeDomainTakenError(err, domainName, cb);
          }
          cb();
        });
      },
      function(cb) {
        // Scan for all applications for this orgId and domainName.
        self.models.Application.scan(orgId)
          .where('orgId').equals(orgId)
          .where('domainName').equals(domainName)
          .attributes(['appId'])
          .exec(self._listCallback(cb));
      },
      function(apps, cb) {
        // Update the domain to null for all the apps.
        async.each(apps, function(app, _cb) {
          // Set the domain and subDomain attributes to null
          self.models.Application.update({
            appId: app.appId,
            domainName: null,
            subDomain: null
          }, _cb);
        }, cb);
      }
    ], callback);
  };

  DynamoDb.prototype.updateDomain = function(domainData, callback) {
    debug('update domain %s with zone %s', domainData.domain, domainData.cdnDistributionId);

    this.models.Domain.update(_.pick(domainData, 'domainName', 'orgId', 'status', 'dnsValue'),
      this._orgIdCondition(domainData.orgId), this._itemCallback(callback));
  };

  function maybeDomainTakenError(err, domainName, callback) {
    if (err.code === 'ConditionalCheckFailedException') {
      debug('domain %s already taken', domainName);
      return callback(Error.create('Domain ' + domainName + ' taken by different app', {
        code: 'domainTaken'
      }));
    }
    return callback(err);
  }
};
