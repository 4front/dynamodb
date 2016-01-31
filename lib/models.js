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
    domainName: Joi.string(),
    subDomain: Joi.string(),
    requireSsl: Joi.boolean().default(false),
    trafficControlEnabled: Joi.boolean().default(false),
    // deployments is a Map where the top level keys are the env names and the values
    // is an array of traffic rules. Each rule consists of a version attribute and a rule
    // attribute.
    trafficRules: Joi.object().pattern(/[a-z]+/, Joi.array(Joi.object().keys({
      version: Joi.string(),
      rule: Joi.string()
    }))).default({}),

    // Addon specific settings. The keys in the object is the name of the addon.
    addOnSettings: Joi.object().pattern(/[a-z]+/, Joi.object()).default({}),
    env: Joi.object().default({})
  },
  indexes: [
    {
      name: 'orgIdIndex',
      type: 'global',
      hashKey: 'orgId',
      projection: {
        ProjectionType: 'KEYS_ONLY'
      }
    },
    {
      name: 'ownerIdIndex',
      type: 'global',
      hashKey: 'ownerId',
      projection: {
        ProjectionType: 'KEYS_ONLY'
      }
    },
    {
      name: 'domainNameIndex',
      type: 'global',
      hashKey: 'domainName',
      rangeKey: 'subDomain',
      projection: {
        ProjectionType: 'KEYS_ONLY'
      }
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
    joined: Joi.date().default(Date.now, 'joined')
  },
  indexes: [
    {
      name: 'providerUserIndex',
      hashKey: 'providerUserId',
      rangeKey: 'provider',
      type: 'global'
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
    ownerId: Joi.string(),
    source: Joi.string(), // Value like 'bitbucket', 'aerobatic', etc.

    addOnSettings: Joi.object().pattern(/[a-z]+/, Joi.object()).default({}),

    // Default environment pipeline as an ordered list
    // Apps can only be promoted in this order
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
  tableName: 'appDomains',
  hashKey: 'domainName',
  timestamps: true,
  schema: {
    domainName: Joi.string(),
    orgId: Joi.string().required(),
    apexAppId: Joi.string(),
    certificateId: Joi.string(),
    cdnDistributionId: Joi.string(),
    status: Joi.string(),
    dnsValue: Joi.string()
  },
  indexes: [
    {
      name: 'orgIdIndex',
      type: 'global',
      hashKey: 'orgId'
    }
  ]
};

models.LegacyDomain = {
  tableName: 'domains',
  hashKey: 'domain',
  schema: {
    domain: Joi.string(),
    appId: Joi.string(),
    action: Joi.string().allow('resolve', 'redirect').default('resolve'),
    orgId: Joi.string().required(),
    certificateId: Joi.string(),
    certificate: Joi.string(),
    zone: Joi.string() // corresponds to something like a CDN distribution
  },
  indexes: [
    {
      name: 'appIdIndex',
      hashKey: 'appId',
      type: 'global'
    },
    {
      name: 'orgIdIndex',
      hashKey: 'orgId',
      type: 'global'
    }
  ]
};

models.Certificate = {
  tableName: 'certificates',
  hashKey: 'name',
  schema: {
    name: Joi.string(),
    certificateId: Joi.string().required(),
    commonName: Joi.string().required(),
    description: Joi.string(),
    orgId: Joi.string().required(),
    zone: Joi.string(),
    expires: Joi.date(),
    uploadDate: Joi.date(),
    altNames: Joi.array(Joi.string()),
    cname: Joi.string(),
    status: Joi.string().required()
  },
  indexes: [
    {
      name: 'orgIdIndex',
      hashKey: 'orgId',
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
  hashKey: 'appId',
  rangeKey: 'versionId',
  schema: {
    appId: Joi.string(),
    versionId: Joi.string(),
    versionNum: Joi.number(),
    name: Joi.string().required(),
    userId: Joi.string().required(),
    created: Joi.date().default(Date.now, 'created'),
    duration: Joi.number(),
    message: Joi.string(),
    status: Joi.string().required().valid(['initiated', 'complete', 'failed', 'timedOut']),
    commit: Joi.string(),

    // The version error if status is 'failed'
    error: Joi.string(),

    // The JSON app manifest for this version
    manifest: Joi.object().required(),
    deploymentParts: Joi.array(Joi.object())
  },
  indexes: [
    {
      name: 'appIdVersionNumIndex',
      type: 'local',
      hashKey: 'appId',
      rangeKey: 'versionNum',
      projection: {
        NonKeyAttributes: ['name', 'userId', 'created', 'message', 'status', 'error'],
        ProjectionType: 'INCLUDE'
      }
    }
  ]
};

models.DailyOperations = {
  tableName: 'dailyOperations',
  hashKey: 'orgId',
  rangeKey: 'dateAppId', // example 2015-03-appid
  schema: {
    orgId: Joi.string(),
    dateAppId: Joi.string(),
    appId: Joi.string(),
    total: Joi.number()
    // Additional attributes are created on the fly with names like "op_html-page, op_api-proxy, etc
    // that hold the count of the number of times that operation was invoked.
  },
  indexes: [
    {
      name: 'appIdIndex',
      type: 'global',
      hashKey: 'appId',
      rangeKey: 'dateAppId'
    }
  ]
};

// Generic table for holding key/values where the value is itself a key/value map
models.KeyValueMap = {
  tableName: 'keyValueMap',
  hashKey: 'key',
  schema: {
    key: Joi.string(),
    value: Joi.object().pattern(/[a-z]+/, Joi.object()).default({}),
    createdDate: Joi.date().default(Date.now, 'createdDate')
  }
};

// Audit trail of actions taken including things like: app created, app deleted,
// version deployed, version promoted, version rolled back
// models.AuditTrail = {
//   tableName: 'auditTrail',
//   hashKey: 'orgId',
//   rangeKey: 'timestamp',
//
//   schema: {
//     appId: Joi.string(),
//     versionId: Joi.string(),
//     action: Joi.string(), // created, promoted, rolledback, softLaunch
//     userId: Joi.string(),
//     timestamp: Joi.date().default(Date.now, 'timestamp')
//   }
// };
