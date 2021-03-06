var _ = require('lodash');
var debug = require('debug')('4front:dynamodb');

var fetchExpressionAttributeNames = {'#name': 'name', '#status': 'status',
  '#commit': 'commit', '#error': 'error', '#duration': 'duration'};

var fetchProjectionExpression = 'versionId, versionNum, #name, userId, created, ' +
  'message, #status, #commit, #error, #duration, hasLog';

module.exports = function(DynamoDb) {
  DynamoDb.prototype.createVersion = function(versionData, callback) {
    this.models.Version.create(versionData, this._itemCallback(callback));
  };

  DynamoDb.prototype.getVersion = function(appId, versionId, callback) {
    var self = this;
    debug('get version appId=%s, versionId=%s', appId, versionId);
    this.incrementRead();
    this.models.Version.get({appId: appId, versionId: versionId}, function(err, data) {
      if (err) return callback(err);
      if (!data) {
        if (self.options.lazyReplicator) {
          self.options.lazyReplicator.trigger({
            source: 'dynamodb',
            region: self.options.region,
            tableName: self.models.Version.tableName(),
            keys: {
              appId: {S: appId}, //eslint-disable-line
              versionId: {S: versionId} //eslint-disable-line
            }
          });
        }
        return callback(null, null);
      }

      callback(null, data.attrs);
    });
  };

  // List the versions for an app
  DynamoDb.prototype.listVersions = function(appId, options, callback) {
    _.defaults(options, {
      excludeIncomplete: true,
      expressionAttributeNames: fetchExpressionAttributeNames,
      projectionExpression: fetchProjectionExpression
    });

    debug('list versions for app %s', appId);

    var chain = this.models.Version.query(appId);

    if (options.excludeIncomplete) {
      chain = chain.filter('status').equals('complete');
    }

    if (options.expressionAttributeNames) {
      chain = chain.expressionAttributeNames(options.expressionAttributeNames);
    }

    if (options.projectionExpression) {
      chain = chain.projectionExpression(options.projectionExpression);
    }

    if (options.limit) {
      chain = chain.limit(options.limit);
    }

    chain.exec(this._listCallback(callback));
  };

  DynamoDb.prototype.updateVersion = function(versionData, callback) {
    this.models.Version.update(versionData, this._itemCallback(callback));
  };

  // Just update the traffic version allocation for a single environment. This is less risky
  // than updating the entire application object.
  DynamoDb.prototype.updateDeployedVersions = function(appId, env, versions, callback) {
    var params = {
      UpdateExpression: 'SET #deployedVersions.' + env + '=:versions',
      ExpressionAttributeNames: {'#deployedVersions': 'deployedVersions'},
      ExpressionAttributeValues: {':versions': versions}
    };

    this.models.Application.update({appId: appId}, params, this._itemCallback(callback));
  };

  // Get the next version for an app.
  DynamoDb.prototype.nextVersionNum = function(appId, callback) {
    this.models.Version.query(appId)
      .usingIndex('appIdVersionNumIndex2')
      .projectionExpression('versionNum')
      .limit(1)
      .descending()
      .exec(function(err, data) {
        if (err) return callback(err);

        if (data.Items.length === 0) return callback(null, 1);

        callback(null, data.Items[0].get('versionNum') + 1);
      });
  };

  DynamoDb.prototype.mostRecentVersion = function(appId, callback) {
    this.models.Version.query(appId)
      .usingIndex('appIdVersionNumIndex2')
      .projectionExpression(fetchProjectionExpression)
      .expressionAttributeNames(fetchExpressionAttributeNames)
      .limit(1)
      .descending()
      .exec(function(err, data) {
        if (err) return callback(err);

        if (data.Items.length === 0) return callback(null, null);

        callback(null, data.Items[0].attrs);
      });
  };

  DynamoDb.prototype.getVersionCount = function(appId, callback) {
    this.models.Version.query(appId)
      .usingIndex('appIdVersionNumIndex2')
      .select('COUNT')
      .exec(function(err, data) {
        if (err) return callback(err);

        callback(null, data.Count);
      });
  };

  DynamoDb.prototype.deleteVersion = function(appId, versionId, callback) {
    this.models.Version.destroy(appId, versionId, callback);
  };
};
