// Nodejs encryption with CTR
var crypto = require('crypto'),
  algorithm = 'aes-256-ctr';

module.exports.encrypt = function(text, password) {
  var cipher = crypto.createCipher(algorithm, password)
  var crypted = cipher.update(text, 'utf8', 'hex')
  crypted += cipher.final('hex');
  return crypted;
};

module.exports.decrypt = function(text, password) {
  var decipher = crypto.createDecipher(algorithm, password)
  var dec = decipher.update(text, 'hex', 'utf8')
  dec += decipher.final('utf8');
  return dec;
};
