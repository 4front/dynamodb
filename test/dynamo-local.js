var DynamoDb = require('../lib/dynamo');

module.exports = new DynamoDb({
  region: 'us-west-2',
  endpoint: 'http://localhost:8000',
  accessKeyId: '4front',
  secretAccessKey: '4front',
  tablePrefix: '4front_',
  cryptoPassword: '3245346345ijdsfgoiashdg'
});
