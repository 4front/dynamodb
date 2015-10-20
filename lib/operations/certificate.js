var _ = require('lodash');
var async = require('async');
var debug = require('debug')('4front:dynamodb');

require('simple-errors');

module.exports = function(DynamoDb) {
  DynamoDb.prototype.createCertificate = function(certData, callback) {
    debug('create certificate %s', certData.name);
    this.models.Certificate.create(certData, this._itemCallback(callback));
  };

  DynamoDb.prototype.getCertificate = function(certificateId, callback) {
    this.models.Certificate.get(certificateId, this._itemCallback(callback));
  };

  DynamoDb.prototype.deleteCertificate = function(orgId, certificateId, callback) {
    debug('delete certificate', certificateId);

    var self = this;
    async.waterfall([
      function(cb) {
        self.models.Domain.query(orgId)
          .usingIndex('orgIdIndex')
          .exec(self._listCallback(cb));
      },
      function(domains, cb) {
        debug('find domains for cert', certificateId);
        var domainsMatchingCert = _.filter(domains, {certificateId: certificateId});

        // Update the certificateId to null for any domains using this cert.
        async.each(domainsMatchingCert, function(domain, _cb) {
          debug('set certificateId to null for domain', domain);
          self.updateDomain({domain: domain.domain, certificateId: null, orgId: orgId}, _cb);
        }, cb);
      },
      function(cb) {
        debug('destroying certificate', certificateId);
        self.models.Certificate.destroy({certificateId: certificateId},
          self._orgIdCondition(orgId), cb);
      }
    ], callback);
  };

  DynamoDb.prototype.updateCertificate = function(certData, callback) {
    // Can't update the domain name itself
    debug('update certificate %s', certData.name);
    this.models.Certificate.update(_.pick(certData, 'certificateId', 'name', 'description'),
      this._orgIdCondition(certData.orgId), function(err, item) {
      if (err) return callback(err);

      callback(null, item.attrs);
    });
  };

  DynamoDb.prototype.listCerticates = function(orgId, callback) {
    debug('list certificates for org', orgId);
    this.models.Certificate.query(orgId).usingIndex('orgIdIndex').exec(this._listCallback(callback));
  };
};
