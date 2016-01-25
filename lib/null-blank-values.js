var _ = require('lodash');

// Recurse through the object removing any empty strings.
module.exports = function(object) {
  nullBlankValues(object);
  return object;
};

function nullBlankValues(object) {
  _.forOwn(object, function(value, key) {
    if (_.isString(value) && value.length === 0) {
      object[key] = null;
    }
    if (_.isObject(value)) {
      nullBlankValues(value);
    }
  });
}
