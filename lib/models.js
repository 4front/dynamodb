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
    ownerId: Joi.string().required(),
    // deployments is two level Map where the top level keys are the env names and the nested
    // keys are versionIds with a numeric value corresponding to the percent traffic
    // to be directed to that version. For example:
    // {
    //   production: {
    //     "v1": .5
    //     "v2": .5
    //   },
    //   test: {
    //     "v2": 1
    //   }
    // }
    trafficRules: Joi.object().pattern(/[a-z]+/, Joi.array(Joi.object().keys({
      version: Joi.string(),
      rule: Joi.string()
    })))
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
    username: Joi.string().required(),
    provider: Joi.string().required(),
    email: Joi.string(),
    avatar: Joi.string(),
    defaultOrgId: Joi.string(),
    lastLogin: Joi.date(),
    joined: Joi.date().default(Date.now, 'joined'),
    secretKey: Joi.string().required()
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
    ownerId: Joi.string().required(),
<<<<<<< HEAD

    // Default environment pipeline as an ordered list
    // Apps can only be promoted in this order
=======
>>>>>>> 037c172f988d8b86ff494bee33780cc066aef677
    environments: Joi.array(Joi.string())
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
  tableName: 'appName',
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

    // The JSON config for this version
    appConfig: Joi.string()
  },
  indexes: [
    {
    	name: 'appIdVersionNumIndex',
    	type: 'global',
    	hashKey: 'appId',
    	rangeKey: 'versionNum',
      projection: { NonKeyAttributes: [ 'userId','created','message' ], ProjectionType: 'INCLUDE' }
    }
  ]
};

// Audit trail of actions taken including things like: app created, app deleted,
// version deployed, version promoted, version rolled back
models.AuditTrail = {
  tableName: 'auditTrail',
  hashKey: 'orgId',
  rangeKey: 'timestamp',

  schema: {
    appId: Joi.string(),
    versionId: Joi.string(),
    action: Joi.string(), // created, promoted, rolledback, softLaunch
    userId: Joi.string(),
    timestamp: Joi.date().default(Date.now, 'timestamp')
  }
};
