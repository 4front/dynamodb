var DynamoDb = require('../lib/dynamo');

module.exports = new DynamoDb({
  region: 'us-west-2',
  endpoint: 'http://localhost:8000',
  accessKeyId: '4front',
  secretAccessKey: '4front',
  tablePrefix: '4front_',
  metrics: {
    increment: function() {}
  },
  crypto: {
    // Just for testing purposes obviously.
    encrypt: function(value) {
      return new Buffer(value).toString('base64');
    },
    decrypt: function(value) {
      return new Buffer(value, 'base64').toString('utf8');
    }
  }
});
