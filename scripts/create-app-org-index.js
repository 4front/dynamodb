// appIdVersionNumIndex2

var AWS = require('aws-sdk');

// Connect to DynamoDB local
var dynamoDb = new AWS.DynamoDB({
  endpoint: 'http://localhost:8000',
  accessKeyId: '4front',
  secretAccessKey: '4front'
});

// Create the domainNameIndex on the applications table.
dynamoDb.updateTable({
  TableName: '4front_applications',
  AttributeDefinitions: [
    {
      AttributeName: 'orgId',
      AttributeType: 'S'
    }
  ],
  GlobalSecondaryIndexUpdates: [
    {
      Create: {
        IndexName: 'orgIdIndex2',
        KeySchema: [
          {
            AttributeName: 'orgId',
            KeyType: 'HASH'
          }
        ],
        Projection: {
          ProjectionType: 'ALL'
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 1,
          WriteCapacityUnits: 1
        }
      }
    }
  ]
}, function(err) {
  if (err) return console.error(err);
  console.log('index created');
});
