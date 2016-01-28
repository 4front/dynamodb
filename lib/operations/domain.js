var _ = require('lodash');
var debug = require('debug')('4front:dynamodb');

require('simple-errors');

module.exports = function(DynamoDb) {
  DynamoDb.prototype.createDomain = function(domainData, callback) {
    // Perform a conditional write to avoid collisions with existing domains
    var params = {
      ConditionExpression: '#domain <> :domain',
      ExpressionAttributeNames: {'#domain': 'domain'},
      ExpressionAttributeValues: {':domain': domainData.domain}
    };

    debug('create domain %s', domainData.domain);
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
    // Perform a conditional write to avoid collisions with existing domains
    this.models.Domain.destroy(domainName, this._orgIdCondition(orgId), function(err) {
      if (err) return maybeDomainTakenError(err, domainName, callback);

      callback();
    });
  };

  DynamoDb.prototype.updateDomain = function(domainData, callback) {
    debug('update domain %s with zone %s', domainData.domain, domainData.zone);
    this.models.Domain.update(_.pick(domainData, 'domain', 'appId', 'action', 'certificate', 'zone'),
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
