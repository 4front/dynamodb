var AWS = require('aws-sdk');

// Connect to DynamoDB local
var dynamoDb = new AWS.DynamoDB({
  region: 'us-west-2',
  endpoint: 'http://localhost:8000',
  accessKeyId: '4front',
  secretAccessKey: '4front'
});

dynamoDb.listTables({}, function(err, data) {
    if (err) print(err); // an error occurred
    else console.log(data); // successful response
});
