const HDWalletProvider = require('truffle-hdwallet-provider');

const mnemonic =
  process.env.MNEMONIC || 'lab direct float merit wall huge wheat loyal maple cup battle butter';

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // for more about customizing your Truffle configuration!
  compilers: {
    solc: {
      version: '0.6.12',
      // ETC version agharta, converted to petersburg based on mapping from: https://github.com/eth-brownie/brownie/blob/fa09e06aa8cd6389a2c461a1490847311a76eb52/brownie/_config.py#L27
      evmVersion: 'petersburg',
      settings: {
        optimizer: {
          enabled: true,
          runs: 1
        }
      }
    }
  },
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      endpoint: 'http://127.0.0.1:8545',
      network_id: '*',
      gas: 6721975,
      gasPrice: 20000000000
    },
    coverage: {
      host: 'localhost',
      network_id: '*', // eslint-disable-line camelcase
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01
    }
  },
  plugins: ["solidity-coverage"],
  mocha: {
    useColors: true,
    bail: true
  }
};