var _ = require('lodash');
var async = require('async');
var debug = require('debug')('4front:dynamodb');

require('simple-errors');

module.exports = function(DynamoDb) {
  DynamoDb.prototype.createCertificate = function(certData, callback) {
    debug('create certificate %s', certData.name);
    this.models.Certificate.create(certData, this._itemCallback(callback));
  };

  DynamoDb.prototype.getCertificate = function(certificateName, callback) {
    this.models.Certificate.get(certificateName, this._itemCallback(callback));
  };

  DynamoDb.prototype.deleteCertificate = function(orgId, certificateName, callback) {
    debug('delete certificate', certificateName);

    var self = this;
    async.waterfall([
      function(cb) {
        self.listDomains(orgId, cb);
      },
      function(domains, cb) {
        debug('find domains for cert', certificateName);
        var domainsMatchingCert = _.filter(domains, {certificate: certificateName});

        // Update the certificate to null for any domains using this cert.
        async.each(domainsMatchingCert, function(domain, _cb) {
          debug('set certificate to null for domain', domain);
          self.updateDomain({domain: domain.domain, certificate: null, orgId: orgId}, _cb);
        }, cb);
      },
      function(cb) {
        debug('destroying certificate', certificateName);
        self.models.Certificate.destroy({name: certificateName},
          self._orgIdCondition(orgId), cb);
      }
    ], callback);
  };

  DynamoDb.prototype.updateCertificate = function(certData, callback) {
    // Can't update the domain name itself
    debug('update certificate %s', certData.name);
    this.models.Certificate.update(_.pick(certData, 'name', 'description'),
      this._orgIdCondition(certData.orgId), function(err, item) {
      if (err) return callback(err);

      callback(null, item.attrs);
    });
  };

  DynamoDb.prototype.listCertificates = function(orgId, callback) {
    debug('list certificates for org', orgId);
    this.models.Certificate.query(orgId).usingIndex('orgIdIndex').exec(this._listCallback(callback));
  };
};
