const Treasury = artifacts.require('Treasury');

module.exports = function (deployer, currentNetwork, [gitcoinAddress, ...accounts]) {
  const clientAddresses = accounts.slice(3);
  deployer.deploy(Treasury, gitcoinAddress, clientAddresses);
};
