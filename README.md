# 4front-dynamo

[DynamoDB](http://aws.amazon.com/dynamodb) based metadata repository for the [4front web platform](http://4front.io). The metadata repository is used to persist information about virtual apps, organizations, users, app versions, environments, and more. Uses the excellent [vogels](https://github.com/ryanfitz/vogels) object mapper package internally.

## Installation
~~~
npm install 4front-dynamo
~~~

## Usage
~~~js
var dynamoDb = require('4front-dynamo')({
	region: 'us-west-2',

	// optional map used to 
	modelExtensions: {
	},
	tablePrefix: ''
});
~~~

## Running Tests
The tests rely on [DynamoDB Local](http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Tools.DynamoDBLocal.html) to be running.

~~~
npm test
~~~