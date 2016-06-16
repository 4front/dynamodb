/* eslint no-console: 0 */

var AWS = require('aws-sdk');

// Connect to DynamoDB local
var dynamoDb = new AWS.DynamoDB({region: 'us-west-2'});

dynamoDb.updateTable({
  TableName: '4front_versions',
  AttributeDefinitions: [
    {
      AttributeName: 'appId', /* required */
      AttributeType: 'S' /* required */
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
        KeySchema: [ /* required */
          {
            AttributeName: 'appId', /* required */
            KeyType: 'HASH' /* required */
          },
          {
            AttributeName: 'versionNum',
            KeyType: 'RANGE'
          }
        ],
        Projection: { /* required */
          NonKeyAttributes: [ 'name', 'userId', 'created', 'message', 'status', 'error' ],
          ProjectionType: 'INCLUDE'
        },
        ProvisionedThroughput: { /* required */
          ReadCapacityUnits: 2, /* required */
          WriteCapacityUnits: 2 /* required */
        }
      }
    }
  ],
}, function(err, data) {
  if (err) console.error(err); // an error occurred
  else console.log(data); // successful response
});
