var async = require('async');
var _ = require('lodash');
var debug = require('debug')('4front:dynamodb');

require('simple-errors');

module.exports = function(DynamoDb) {

	DynamoDb.prototype.createDomain = function(appId, domainName, callback) {
    // Perform a conditional write to avoid collisions with existing domains
    var params = {
      ConditionExpression: '#domain <> :domain',
      ExpressionAttributeNames: {'#domain': 'domain'},
      ExpressionAttributeValues: {':domain': domainName}
    };

    debug("create domain %s", domainName);
    this.models.Domain.create({domain: domainName, appId: appId}, params, function(err, domain) {
      if (err)
        return maybeDomainTakenError(err, domainName, callback);

      callback(null, domain);
    });
  };

  DynamoDb.prototype.getDomain = function(domainName, callback) {
    this.models.Domain.get(domainName, this._itemCallback(callback));
  };

  DynamoDb.prototype.deleteDomain = function(appId, domainName, callback) {
    // Perform a conditional write to avoid collisions with existing domains
    this.models.Domain.destroy(domainName, appIdCondition(appId), function(err) {
      if (err)
        return maybeDomainTakenError(err, domainName, callback);

      callback();
    });
  };

  DynamoDb.prototype.updateDomain = function(appId, domainName, zone, callback) {
    // Perform a conditional write to avoid collisions with existing domains
    debug("update domain %s with zone %s", domainName, zone);
    this.models.Domain.update({domain: domainName, zone: zone}, appIdCondition(appId), function(err, item) {
      if (err)
        return maybeDomainTakenError(err, domainName, callback);

      callback(null, item.attrs);
    });
  };

  function maybeDomainTakenError(err, domainName, callback) {
    if (err.code === "ConditionalCheckFailedException") {
      debug("domain %s already taken", domainName);
      return callback(Error.create("Domain " + domainName + " taken by different app", {code: 'domainTaken'}));
    }
    else
      return callback(err);
  }

  function appIdCondition(appId) {
    return {
      ConditionExpression: '#appId = :appId',
      ExpressionAttributeNames: {'#appId': 'appId'},
      ExpressionAttributeValues: {':appId': appId}
    };
  }
};
