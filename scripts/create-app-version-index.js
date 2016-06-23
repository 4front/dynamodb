// appIdVersionNumIndex2

var AWS = require('aws-sdk');

// Connect to DynamoDB local
var dynamoDb = new AWS.DynamoDB({
  region: 'eu-central-1'
  // endpoint: 'http://localhost:8000',
  // accessKeyId: '4front',
  // secretAccessKey: '4front'
});

// Create the domainNameIndex on the applications table.
dynamoDb.updateTable({
  TableName: '4front_versions',
  AttributeDefinitions: [
    {
      AttributeName: 'appId',
      AttributeType: 'S'
    },
    {
      AttributeName: 'versionId',
      AttributeType: 'S'
    },
    {
      AttributeName: 'versionNum',
      AttributeType: 'N'
    }
  ],
  GlobalSecondaryIndexUpdates: [
    {
      Create: {
        IndexName: 'appIdVersionNumIndex2',
        KeySchema: [
          {
            AttributeName: 'appId',
            KeyType: 'HASH'
          },
          {
            AttributeName: 'versionNum',
            KeyType: 'RANGE'
          }
        ],
        Projection: {
          ProjectionType: 'INCLUDE',
          NonKeyAttributes: ['userId', 'name', 'error', 'message', 'created', 'status']
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
