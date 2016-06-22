var AWS = require('aws-sdk');

// Connect to DynamoDB local
var dynamoDb = new AWS.DynamoDB({
  region: 'us-west-2',
  endpoint: 'http://localhost:8000',
  accessKeyId: '4front',
  secretAccessKey: '4front'
});

// Create the domainNameIndex on the applications table.
dynamoDb.updateTable({
  TableName: '4front_applications',
  AttributeDefinitions: [
    {
      AttributeName: 'domainName',
      AttributeType: 'S'
    },
    {
      AttributeName: 'subDomain',
      AttributeType: 'S'
    }
  ],
  GlobalSecondaryIndexUpdates: [
    {
      Create: {
        IndexName: 'domainNameIndex2',
        KeySchema: [
          {
            AttributeName: 'domainName',
            KeyType: 'HASH'
          },
          {
            AttributeName: 'subDomain',
            KeyType: 'RANGE'
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
