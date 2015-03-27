var Joi = require('joi');

var models = module.exports = {};

models.Application = {
  tableName: 'applications',
	hashKey: 'appId',
	schema: {
  	appId: Joi.string(),
    orgId: Joi.string().required(),
    created: Joi.date().default(Date.now, 'created'),
    updated: Joi.date().default(Date.now, 'updated'),
    ownerId: Joi.string().required()
  },
  indexes: [
    {
      name: 'orgIdIndex',
      type: 'global',
      hashKey: 'orgId'
    },
    {
      name: 'ownerIdIndex',
      type: 'global',
      hashKey: 'ownerId'
    }
  ]
};

models.User = {
  tableName: 'users',
  hashKey: 'userId',
  schema: {
    userId: Joi.string(),
    providerUserId: Joi.string().required(),
    username: Joi.string(),
    provider: Joi.string(),
    email: Joi.string(),
    avatar: Joi.string(),
    defaultOrgId: Joi.string(),
    lastLogin: Joi.date(),
    joined: Joi.date().default(Date.now, 'joined'),
    secretKey: Joi.string()
  },
  indexes : [
    {
      name : 'providerUserIndex',
      hashKey : 'providerUserId', 
      rangeKey : 'provider',
      type : 'global'
    }
  ]
};

models.Organization = {
  tableName: 'organizations',
  hashKey: 'orgId',
  schema: {
    orgId: Joi.string(),
    name: Joi.string().required(),
    createdDate: Joi.date().default(Date.now, 'createdDate'),
    activatedDate: Joi.date(),
    activated: Joi.boolean().default(false),
    terminated: Joi.boolean().default(false),
    terminationDate: Joi.date(),
    terminatedBy: Joi.string(),
    ownerId: Joi.string().required()
  }
};

models.OrgMember = {
  tableName: 'orgMembers',
  hashKey: 'orgId',
  rangeKey: 'userId',
  schema: {
    orgId: Joi.string(),
    userId: Joi.string(),
    created: Joi.date().default(Date.now, 'joined'),
    role: Joi.string().required()
  },
  indexes: [
    {
      name: 'userIdIndex',
      type: 'global',
      hashKey: 'userId'
    }
  ]
};

models.Domain = {
  tableName: 'domains',
	hashKey: 'domain',
  schema: {
    domain: Joi.string(),
    appId: Joi.string().required()
  },
  indexes: [
    {
      name: 'appIdIndex',
      hashKey: 'appId',
      type: 'global'
    }
  ]
};

models.AppName = {
  tableName: 'appNames',
  hashKey: 'name',
  schema: {
    name: Joi.string(),
    appId: Joi.string().required()
  },
  indexes: [
    {
      name: 'appIdIndex',
      type: 'global',
      hashKey: 'appId'
    }
  ]
};

models.Version = {
  tableName: 'versions',
	hashKey: 'versionId',
  schema: {
    versionId: Joi.string(),
    versionNum: Joi.number(),
    appId: Joi.string().required(),
    name: Joi.string().required(),
    userId: Joi.string().required(),
    created: Joi.date().default(Date.now, 'created'),
    message: Joi.string(),
    // Store an array of the environments where this version is deployed
    // and optionally what percentage of traffic should be directed 
    // to it.
    deployments: Joi.object().pattern(/[a-z]+/, Joi.number()),
    // deployments: Joi.array().items(Joi.object().keys({
    //   envId: Joi.string(),
    //   traffic: Joi.number()
    // })),
    // The JSON config for this version
    config: Joi.string()
  },
  indexes: [
    {
    	name: 'appIdVersionNumIndex',
    	type: 'global',
    	hashKey: 'appId',
    	rangeKey: 'versionNum'
      // projection: { NonKeyAttributes: [ 'userId','created','message','deployments' ], ProjectionType: 'INCLUDE' }
    }
  ]
};