var _ = require('lodash');
var async = require('async');
var shortid = require('shortid');
var assert = require('assert');

require('dash-assert');

describe('Domain', function() {
  var dynamo = require('./dynamo-local');

  it('get and update domain', function(done) {
    var domain = shortid.generate() + '.com';
    var appId = shortid.generate();
    var orgId = shortid.generate();
    var zone = '123';

    async.series([
      function(cb) {
        dynamo.models.Domain.create({domain: domain, appId: appId, orgId: orgId}, cb);
      },
      function(cb) {
        dynamo.getDomain(domain, function(err, data) {
          if (err) return done(err);

          assert.equal(data.action, 'resolve');
          assert.equal(data.domain, domain);
          assert.equal(data.appId, appId);
          cb();
        });
      },
      function(cb) {
        dynamo.updateDomain({domain: domain, appId: appId, orgId: orgId, zone: zone}, cb);
      },
      function(cb) {
        dynamo.getDomain(domain, function(err, _domain) {
          if (err) return cb(err);

          assert.equal(_domain.zone, zone);
          cb();
        });
      }
    ], done);
  });

  it('does not allow duplicate domains', function(done) {
    var domainName = 'www.' + shortid.generate() + '.com';

    var appId = shortid.generate();
    var orgId = shortid.generate();

    async.series([
      function(cb) {
        dynamo.createDomain({appId: appId, orgId: orgId, domain: domainName}, cb);
      },
      function(cb) {
        // Try to create the same domain for a different app
        dynamo.createDomain({appId: appId, orgId: orgId, domain: domainName}, function(err) {
          assert.equal(err.code, 'domainTaken');
          cb();
        });
      },
      function(cb) {
        dynamo.getDomain(domainName, function(err, domain) {
          assert.equal(domain.appId, appId);
          cb();
        });
      }
    ], done);
  });

  it('update domains', function(done) {
    var appId = shortid.generate();
    var orgId = shortid.generate();

    var originalDomains = _.times(3, function() {
      return shortid.generate() + '.domain.com';
    });
    var newDomain = shortid.generate() + '.domain.com';

    async.series([
      function(cb) {
        async.each(originalDomains, function(domainName, cb1) {
          dynamo.createDomain({appId: appId, orgId: orgId, domain: domainName}, cb1);
        }, cb);
      },
      function(cb) {
        dynamo.models.Domain.query(appId)
          .usingIndex('appIdIndex')
          .exec(function(err, domains) {
            var updatedDomains = _.map(domains.Items, function(item) {
              return item.attrs.domain;
            });

            assert.noDifferences(updatedDomains, originalDomains);
            cb();
          });
      },
      function(cb) {
        // Add a new domain
        dynamo.createDomain({appId: appId, domain: newDomain, orgId: orgId}, cb);
      },
      function(cb) {
        dynamo.deleteDomain(orgId, originalDomains[1], cb);
      },
      function(cb) {
        dynamo.models.Domain.query(appId)
          .usingIndex('appIdIndex')
          .exec(function(err, domains) {
            var updatedDomains = _.map(domains.Items, function(item) {
              return item.attrs.domain;
            });

            assert.noDifferences(updatedDomains,
              [originalDomains[0], originalDomains[2], newDomain]);

            cb();
          });
      }
    ], done);
  });

  it('try delete domain from different org', function(done) {
    var domainName = shortid.generate() + '.domain.com';

    async.series([
      function(cb) {
        dynamo.createDomain({orgId: shortid.generate(), domain: domainName}, cb);
      },
      function(cb) {
        dynamo.createDomain({orgId: shortid.generate(), domain: domainName}, function(err) {
          assert.equal(err.code, 'domainTaken');
          cb();
        });
      }
    ], done);
  });
});
