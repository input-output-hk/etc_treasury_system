const chai = require('chai');

const {
  utils: { BN },
  eth: { getBalance },
} = web3;

chai.use(require('chai-bn')(BN)).should();

exports.getBalanceBN = (...args) => getBalance(...args).then((b) => new BN(b));
exports.BN = BN;
