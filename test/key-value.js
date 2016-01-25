var async = require('async');
var shortid = require('shortid');
var assert = require('assert');

require('dash-assert');

describe('keyValueMap', function() {
  var dynamo = require('./dynamo-local');

  beforeEach(function() {
  });

  it('writes mapKey for brand new keyValue', function(done) {
    var key = shortid.generate();
    var mapKey = shortid.generate();
    var mapValue = {
      foo: 1,
      bar: 'hello'
    };

    dynamo.setKeyMapValue(key, mapKey, mapValue, function(err) {
      if (err) return done(err);

      dynamo.getKeyMapValue(key, mapKey, function(_err, value) {
        if (_err) return done(_err);

        assert.deepEqual(value, mapValue);

        done();
      });
    });
  });

  it('writes mapKey for existing keyValue', function(done) {
    var key = shortid.generate();

    var map = {
      original: {foo: 1},
      additional: {foo: 2}
    };

    async.series([
      function(cb) {
        dynamo.setKeyMapValue(key, 'original', map.original, cb);
      },
      function(cb) {
        dynamo.setKeyMapValue(key, 'additional', map.additional, cb);
      },
      function(cb) {
        // Make sure the original value is still there
        dynamo.getKeyMapValue(key, 'original', function(err, value) {
          if (err) return cb(err);

          assert.deepEqual(value, map.original);
          cb();
        });
      },
      function(cb) {
        // Now fetch the additional value
        dynamo.getKeyMapValue(key, 'additional', function(err, value) {
          if (err) return cb(err);

          assert.deepEqual(value, map.additional);
          cb();
        });
      }
    ], done);
  });

  it('deletes existing map key/value', function(done) {
    var key = shortid.generate();

    var map = {
      first: {foo: 1},
      second: {foo: 2}
    };

    async.series([
      function(cb) {
        dynamo.setKeyMapValue(key, 'first', map.first, cb);
      },
      function(cb) {
        dynamo.setKeyMapValue(key, 'second', map.second, cb);
      },
      function(cb) {
        dynamo.deleteKeyMapKey(key, 'first', cb);
      },
      function(cb) {
        dynamo.getKeyMapValue(key, 'first', function(err, value) {
          if (err) return cb(err);

          assert.isNull(value);
          cb();
        });
      },
      function(cb) {
        dynamo.getKeyMapValue(key, 'second', function(err, value) {
          if (err) return cb(err);

          assert.deepEqual(value, map.second);
          cb();
        });
      }
    ], done);
  });

  it('delete missing mapKey', function(done) {
    var key = shortid.generate();

    async.series([
      function(cb) {
        dynamo.setKeyMapValue(key, 'foo', {bar: 1}, cb);
      },
      function(cb) {
        dynamo.deleteKeyMapKey(key, 'missing', cb);
      },
      function(cb) {
        dynamo.getKeyMapValue(key, 'foo', function(err, value) {
          if (err) return cb(err);

          assert.deepEqual(value, {bar: 1});
          cb();
        });
      }
    ], done);
  });

  it('delete entire key', function(done) {
    var key = shortid.generate();

    async.series([
      function(cb) {
        dynamo.setKeyMapValue(key, 'foo', {bar: 1}, cb);
      },
      function(cb) {
        dynamo.deleteKeyMap(key, cb);
      },
      function(cb) {
        dynamo.getKeyMapValue(key, 'foo', function(err, value) {
          if (err) return cb(err);

          assert.isNull(value);
          cb();
        });
      }
    ], done);
  });

  it('delete non-existant key', function(done) {
    var key = shortid.generate();

    dynamo.deleteKeyMap(key, done);
  });
});
