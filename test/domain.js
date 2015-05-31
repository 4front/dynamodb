var _ = require('lodash');
var async = require('async');
var shortid = require('shortid');
var assert = require('assert');

require('dash-assert');

describe('Domain', function() {
	var dynamo = require('./dynamo-local');
	var self;

  it('get and update domain', function(done) {
		var domain = shortid.generate() + '.com';
		var appId = shortid.generate();
		var zone = '123';

		async.series([
			function(cb){
				dynamo.models.Domain.create({domain: domain, appId: appId}, cb);
			},
			function(cb) {
				dynamo.getDomain(domain, function(err, data) {
					if (err) return done(err);

					assert.equal(data.domain, domain);
					assert.equal(data.appId, appId);
					cb();
				});
			},
			function(cb) {
				dynamo.updateDomain(domain, appId, zone, cb);
			},
			function(cb) {
				dynamo.getDomain(domain, function(err, domain) {
					if (err) return cb(err);

					assert.equal(domain.zone, zone);
					cb();
				});
			}
		], done);
	});

	it('does not allow duplicate domains', function(done) {
		var self = this;
		var domainName = "www." + shortid.generate() + ".com";

    var appId = shortid.generate();

		async.series([
			function(cb) {
				dynamo.createDomain(appId, domainName, cb);
			},
      function(cb) {
        // Try to create the same domain for a different app
				dynamo.createDomain(shortid.generate(), domainName, function(err, domain) {
          assert.equal(err.code, 'domainTaken');
          cb();
        });
			},
      function(cb) {
        dynamo.getDomain(domainName, function(err, domain) {
          assert.equal(domain.appId, appId);
          cb();
        })
      }
    ], done);
	});

  it('update domains', function(done) {
    var appId = shortid.generate();

    var originalDomains = _.times(3, function() {
      return shortid.generate() + '.domain.com';
    });
    var newDomain = shortid.generate() + '.domain.com';

    async.series([
      function(cb) {
        async.each(originalDomains, function(domainName, cb1) {
          dynamo.createDomain(appId, domainName, cb1);
        }, cb);
      },
      function(cb) {
        dynamo.models.Domain.query(appId)
          .usingIndex('appIdIndex')
          .exec(function(err, domains) {
            assert.noDifferences(_.map(domains.Items, _.property('attrs.domain')), originalDomains);
            cb();
          });
      },
      function(cb) {
        // Add a new domain
        dynamo.createDomain(appId, newDomain, cb);
      },
      function(cb) {
        dynamo.deleteDomain(appId, originalDomains[1], cb);
      },
      function(cb) {
        dynamo.models.Domain.query(appId)
          .usingIndex('appIdIndex')
          .exec(function(err, domains) {
            assert.noDifferences(_.map(domains.Items, _.property('attrs.domain')),
              [originalDomains[0], originalDomains[2], newDomain]);
            cb();
          });
      }
    ], done);
  });

  it('try delete domain from different app', function(done) {
    var domainName = shortid.generate() + '.domain.com';
    var appId = shortid.generate();

    async.series([
      function(cb) {
        dynamo.createDomain(shortid.generate(), domainName, cb);
      },
      function(cb) {

        dynamo.createDomain(shortid.generate(), domainName, function(err) {
          assert.equal(err.code, "domainTaken");
          cb();
        });
      }
    ], done);
  });
});
