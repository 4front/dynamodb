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
      name: 'www.' + shortid.generate() + '.com',
      zone: 'zone1',
      description: 'domain cert'
    };

    async.series([
      function(cb) {
        dynamo.createCertificate(certData, cb);
      },
      function(cb) {
        dynamo.getCertificate(certData.name, function(err, data) {
          if (err) return done(err);

          assert.isMatch(data, certData);
          cb();
        });
      },
      function(cb) {
        dynamo.updateCertificate(_.extend(certData, {description: 'new description'}), cb);
      },
      function(cb) {
        dynamo.getCertificate(certData.name, function(err, cert) {
          if (err) return cb(err);

          assert.equal(cert.description, 'new description');
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

    var certs = _.times(3, function() {
      return _.extend({}, certData, {
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
        dynamo.listCertificates(certData.orgId, function(err, data) {
          if (err) return cb(err);

          assert.equal(data.length, certs.length);
          cb();
        });
      }
    ], done);
  });

  it('delete certificate', function(done) {
    var certData = {
      orgId: shortid.generate(),
      name: 'www.' + shortid.generate() + '.com',
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
          certificate: cert.name,
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
