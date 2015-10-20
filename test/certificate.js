var _ = require('lodash');
var async = require('async');
var shortid = require('shortid');
var assert = require('assert');

require('dash-assert');

describe('Certificate', function() {
  var dynamo = require('./dynamo-local');

  it('get and update certificate', function(done) {
    var certData = {
      orgId: shortid.generate(),
      certificateId: shortid.generate(),
      name: 'www.domain.com',
      zone: 'zone1',
      description: 'domain cert'
    };

    async.series([
      function(cb) {
        dynamo.createCertificate(certData, cb);
      },
      function(cb) {
        dynamo.getCertificate(certData.certificateId, function(err, data) {
          if (err) return done(err);

          assert.isMatch(data, certData);
          cb();
        });
      },
      function(cb) {
        dynamo.updateCertificate(_.extend(certData, {name: 'www.domain1.com'}), cb);
      },
      function(cb) {
        dynamo.getCertificate(certData.certificateId, function(err, cert) {
          if (err) return cb(err);

          assert.equal(cert.name, 'www.domain1.com');
          cb();
        });
      }
    ], done);
  });

  it('list certificates for org', function(done) {
    var certData = {
      orgId: shortid.generate(),
      zone: 'zone1',
      description: 'domain cert'
    };

    async.series([
      function(cb) {
        async.times(3, function(i, next) {
          dynamo.createCertificate(_.extend({}, certData, {
            certificateId: shortid.generate(),
            name: 'www.domain' + i + '.com'
          }), next);
        }, cb);
      },
      function(cb) {
        dynamo.listCerticates(certData.orgId, function(err, certs) {
          if (err) return cb(err);

          assert.equal(certs.length, 3);
          cb();
        });
      }
    ], done);
  });

  it('delete certificate', function(done) {
    var certData = {
      orgId: shortid.generate(),
      certificateId: shortid.generate(),
      name: 'www.domain.com',
      zone: 'zone1',
      description: 'domain cert'
    };

    var domains = [
      shortid.generate() + '.domain.com',
      shortid.generate() + '.domain.com'
    ];

    var cert;
    async.series([
      function(cb) {
        dynamo.createCertificate(certData, function(err, data) {
          if (err) return cb(err);
          cert = data;
          cb();
        });
      },
      function(cb) {
        // Create a domain bound to this cert
        dynamo.createDomain({
          domain: domains[0],
          certificateId: cert.certificateId,
          orgId: cert.orgId
        }, cb);
      },
      function(cb) {
        // Create another domain not bound to the cert
        dynamo.createDomain({
          domain: domains[1],
          orgId: cert.orgId
        }, cb);
      },
      function(cb) {
        dynamo.deleteCertificate(cert.orgId, cert.certificateId, cb);
      },
      function(cb) {
        dynamo.listCerticates(cert.orgId, function(err, certs) {
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
            return _.isUndefined(domain.certificateId);
          }));

          cb();
        });
      }
    ], done);
  });
});
