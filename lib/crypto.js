// Nodejs encryption with CTR
var crypto = require('crypto'),
  algorithm = 'aes-256-ctr';

var PREAMBLE = '__ENCRYPTED__';

module.exports.encrypt = function(text, password) {
  var cipher = crypto.createCipher(algorithm, password)
  var crypted = cipher.update(text, 'utf8', 'hex')
  crypted += cipher.final('hex');
  return PREAMBLE + crypted;
};

module.exports.decrypt = function(text, password) {
  if (text.slice(0, PREAMBLE.length) !== PREAMBLE)
    return text;

  var decipher = crypto.createDecipher(algorithm, password)
  var dec = decipher.update(text.slice(PREAMBLE.length), 'hex', 'utf8')
  dec += decipher.final('utf8');
  return dec;
};
