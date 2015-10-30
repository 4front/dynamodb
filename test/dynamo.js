// var shortid = require('shortid');
// var assert = require('assert');
// var DynamoDb = require('../lib/dynamo');

describe('dynamo', function() {
	// it('model extensions', function(done) {
	// 	var dynamo = new DynamoDb({
	// 		region: 'us-west-2',
	// 	  endpoint: 'http://localhost:8000',
	// 		modelExtensions: {
	// 			AppName: {
	// 				// tableName: 'customAppName',
	// 				schema: {
	// 					customColumn: Joi.string().required()
	// 				}
	// 			}
	// 		}
	// 	});

	// 	// assert.equal('customAppName', dynamo.models.AppName.tableName());

	// 	// vogels.models['Application'];

	// 	dynamo.models.AppName.describeTable(function(err, table) {
	// 		debugger;
	// 		assert.ok(err);
	// 		assert.equal('ResourceNotFoundException', err.code);
	// 		done();
	// 	});

	// 	// dynamo.models.AppName.create({appName: shortid.generate(), appId: shortid.generate()}, function(err) {
	// 	// 	assert.ok(err);
	// 	// 	assert.equal("\"customColumn\" is required", err.message);
	// 	// 	done();
	// 	// });
	// });
});
