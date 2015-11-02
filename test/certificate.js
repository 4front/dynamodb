var _ = require('lodash');
var async = require('async');
var shortid = require('shortid');
var assert = require('assert');

require('dash-assert');

describe('Certificate', function() {
  var dynamo = require('./dynamo-local');
  var self;

  beforeEach(function() {
    self = this;

    var commonName = 'www.' + shortid.generate() + '.com';
    this.certData = {
      orgId: shortid.generate(),
      name: commonName,
      commonName: commonName,
      certificateId: shortid.generate(),
      zone: shortid.generate(),
      cname: 'abc.cdn.com',
      description: 'domain cert',
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(), // one year
      uploadDate: new Date().toISOString(),
      status: 'InProgress'
    };
  });

  it('get and update certificate', function(done) {
    async.series([
      function(cb) {
        dynamo.createCertificate(self.certData, cb);
      },
      function(cb) {
        dynamo.getCertificate(self.certData.name, function(err, cert) {
          if (err) return done(err);

          assert.isMatch(cert, self.certData);
          cb();
        });
      },
      function(cb) {
        dynamo.updateCertificate(_.extend({}, self.certData, {description: 'new description'}), cb);
      },
      function(cb) {
        dynamo.getCertificate(self.certData.name, function(err, cert) {
          if (err) return cb(err);

          assert.equal(cert.description, 'new description');
          cb();
        });
      }
    ], done);
  });

  it('list certificates for org', function(done) {
    var certs = _.times(3, function() {
      return _.extend({}, self.certData, {
        name: 'www.' + shortid.generate() + '.com'
      });
    });

    async.series([
      function(cb) {
        async.each(certs, function(cert, next) {
          dynamo.createCertificate(cert, next);
        }, cb);
      },
      function(cb) {
        dynamo.listCertificates(self.certData.orgId, function(err, data) {
          if (err) return cb(err);

          assert.equal(data.length, certs.length);
          cb();
        });
      }
    ], done);
  });

  it('delete certificate', function(done) {
    var domains = [
      shortid.generate() + '.domain.com',
      shortid.generate() + '.domain.com'
    ];

    var cert;
    async.series([
      function(cb) {
        dynamo.createCertificate(self.certData, function(err, data) {
          if (err) return cb(err);
          cert = data;
          cb();
        });
      },
      function(cb) {
        // Create a domain bound to this cert
        dynamo.createDomain({
          domain: domains[0],
          certificate: cert.name,
          zone: cert.zone,
          orgId: cert.orgId
        }, cb);
      },
      function(cb) {
        // Create another domain not bound to the cert
        dynamo.createDomain({
          domain: domains[1],
          orgId: cert.orgId,
          zone: shortid.generate()
        }, cb);
      },
      function(cb) {
        dynamo.deleteCertificate(cert.orgId, cert.name, cb);
      },
      function(cb) {
        dynamo.listCertificates(cert.orgId, function(err, certs) {
          if (err) return cb(err);

          assert.equal(0, certs.length);
          cb();
        });
      },
      function(cb) {
        dynamo.listDomains(cert.orgId, function(err, data) {
          if (err) return cb(err);
          assert.equal(2, data.length);

          assert.isTrue(_.all(data, function(domain) {
            return _.isUndefined(domain.certificate);
          }));

          cb();
        });
      }
    ], done);
  });
});
