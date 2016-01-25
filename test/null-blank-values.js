var assert = require('assert');
var nullBlankValues = require('../lib/null-blank-values');

describe('nullBlankValues', function() {
  it('nulls out blank values', function() {
    var obj = {
      principal: {
        user: {
          name: 'tester',
          location: ''
        }
      },
      key: {
        value: '244',
        website: ''
      }
    };

    assert.deepEqual(nullBlankValues(obj), {
      principal: {
        user: {
          name: 'tester',
          location: null
        }
      },
      key: {
        value: '244',
        website: null
      }
    });
  });
});
