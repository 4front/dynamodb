var DynamoDb = require('../lib/dynamo');

module.exports.newLocalDynamo = function() {
  return new DynamoDb({
    region: 'us-west-2',
    endpoint: 'http://localhost:8000',
    accessKeyId: '4front',
    secretAccessKey: 'accessKeySecret'
  });
};
