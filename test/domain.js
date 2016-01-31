var _ = require('lodash');
var async = require('async');
var shortid = require('shortid');
var assert = require('assert');

require('dash-assert');

describe('Domain', function() {
  var dynamo = require('./dynamo-local');

  it('get and update domain', function(done) {
    var domainName = shortid.generate() + '.com';
    var orgId = shortid.generate();
    var certificateId = shortid.generate();
    var cdnDistributionId = shortid.generate();
    var dnsValue = shortid.generate() + '.cloudfront.net';

    async.series([
      function(cb) {
        dynamo.models.Domain.create({
          domainName: domainName,
          orgId: orgId,
          cdnDistributionId: cdnDistributionId,
          certificateId: certificateId,
          dnsValue: dnsValue
        }, cb);
      },
      function(cb) {
        dynamo.getDomain(domainName, function(err, data) {
          if (err) return done(err);

          assert.isMatch(data, {
            domainName: domainName,
            orgId: orgId,
            certificateId: certificateId
          });

          cb();
        });
      },
      function(cb) {
        dynamo.updateDomain({
          domainName: domainName,
          orgId: orgId,
          dnsValue: dnsValue,
          cdnDistributionId: cdnDistributionId
        }, cb);
      },
      function(cb) {
        dynamo.getDomain(domainName, function(err, _domain) {
          if (err) return cb(err);

          assert.isMatch(_domain, {
            dnsValue: dnsValue,
            cdnDistributionId: cdnDistributionId
          });
          cb();
        });
      }
    ], done);
  });

  it('does not allow duplicate domains', function(done) {
    var domainName = shortid.generate() + '.com';

    var orgId = shortid.generate();
    async.series([
      function(cb) {
        dynamo.createDomain({domainName: domainName, orgId: orgId}, cb);
      },
      function(cb) {
        // Try to create the same domain for a different app
        dynamo.createDomain({domainName: domainName, orgId: orgId}, function(err) {
          assert.equal(err.code, 'domainTaken');
          cb();
        });
      },
      function(cb) {
        dynamo.getDomain(domainName, function(err, domain) {
          assert.equal(domain.orgId, orgId);
          cb();
        });
      }
    ], done);
  });

  it('update domains', function(done) {
    var orgId = shortid.generate();

    var originalDomains = _.times(3, function() {
      return shortid.generate() + '.com';
    });
    var newDomain = shortid.generate() + '.com';

    async.series([
      function(cb) {
        async.each(originalDomains, function(domainName, cb1) {
          dynamo.createDomain({orgId: orgId, domainName: domainName}, cb1);
        }, cb);
      },
      function(cb) {
        dynamo.models.Domain.query(orgId)
          .usingIndex('orgIdIndex')
          .exec(function(err, domains) {
            var updatedDomains = _.map(domains.Items, function(item) {
              return item.attrs.domainName;
            });

            assert.noDifferences(updatedDomains, originalDomains);
            cb();
          });
      },
      function(cb) {
        // Add a new domain
        dynamo.createDomain({domainName: newDomain, orgId: orgId}, cb);
      },
      function(cb) {
        dynamo.deleteDomain(orgId, originalDomains[1], cb);
      },
      function(cb) {
        dynamo.models.Domain.query(orgId)
          .usingIndex('orgIdIndex')
          .exec(function(err, domains) {
            var updatedDomains = _.map(domains.Items, function(item) {
              return item.attrs.domainName;
            });

            assert.noDifferences(updatedDomains,
              [originalDomains[0], originalDomains[2], newDomain]);

            cb();
          });
      }
    ], done);
  });

  it('try delete domain from different org', function(done) {
    var domainName = shortid.generate() + '.com';

    async.series([
      function(cb) {
        dynamo.createDomain({orgId: shortid.generate(), domainName: domainName}, cb);
      },
      function(cb) {
        dynamo.createDomain({orgId: shortid.generate(), domainName: domainName}, function(err) {
          assert.equal(err.code, 'domainTaken');
          cb();
        });
      }
    ], done);
  });

  it('delete domain clears domainName and subDomain from apps', function(done) {
    var domainName = shortid.generate() + '.com';
    var orgId = shortid.generate();
    var appIds = [];

    async.series([
      function(cb) {
        dynamo.createDomain({orgId: orgId, domainName: domainName}, cb);
      },
      function(cb) {
        // Set the domainName for a couple of apps.
        async.times(2, function(i, _cb) {
          var appId = shortid.generate();
          appIds.push(appId);
          dynamo.models.Application.create({
            appId: appId,
            orgId: orgId,
            ownerId: '123',
            domainName: domainName,
            subDomain: 'www' + i
          }, _cb);
        }, cb);
      },
      function(cb) {
        dynamo.deleteDomain(orgId, domainName, cb);
      },
      function(cb) {
        async.each(appIds, function(appId, _cb) {
          dynamo.models.Application.get(appId, function(err, item) {
            if (err) return _cb(err);
            assert.isEmpty(item.attrs.domainName);
            assert.isEmpty(item.attrs.subDomain);
            _cb();
          });
        }, cb);
      }
    ], done);
  });
});
