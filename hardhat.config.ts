import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-solhint";
import "@nomiclabs/hardhat-waffle";
import { config as dotenvConfig } from "dotenv";
import "hardhat-contract-sizer";
import "hardhat-docgen";
import "hardhat-gas-reporter";
import "hardhat-preprocessor";
import "hardhat-deploy";
import { removeConsoleLog } from "hardhat-preprocessor";
import "hardhat-prettier";
import { HardhatUserConfig } from "hardhat/config";
import { NetworkUserConfig } from "hardhat/types";
import { resolve } from "path";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-abi-exporter";
import "solidity-coverage";

// This is done to have the new matchers from waffle,
// because despite the note in https://hardhat.org/guides/waffle-testing.html?#adapting-the-tests
// the changeEtherBalance is not added because its a newer version
import chai from "chai";
import { solidity } from "ethereum-waffle";
chai.use(solidity);

dotenvConfig({ path: resolve(__dirname, "./.env") });

const chainIds = {
  ganache: 1337,
  goerli: 5,
  hardhat: 31337,
  kovan: 42,
  mainnet: 1,
  rinkeby: 4,
  ropsten: 3,
  sagano: 42,
};

// Ensure that we have all the environment variables we need.
let mnemonic: string;
if (!process.env.MNEMONIC) {
  throw new Error("Please set your MNEMONIC in a .env file");
} else {
  mnemonic = process.env.MNEMONIC;
}

let infuraApiKey: string;
if (!process.env.INFURA_API_KEY) {
  throw new Error("Please set your INFURA_API_KEY in a .env file");
} else {
  infuraApiKey = process.env.INFURA_API_KEY;
}

const createTestnetConfig = (network: keyof typeof chainIds): NetworkUserConfig => {
  let url = "https://" + network + ".infura.io/v3/" + infuraApiKey;
  if (network === "sagano") url = process.env.SAGANO_NODE_URL || "";

  return {
    accounts: {
      count: 25,
      initialIndex: 0,
      mnemonic,
      path: "m/44'/60'/0'/0",
    },
    chainId: chainIds[network],
    url,
  };
};

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
    donator: 1,
    trustedAddress: 2,
    otherAccount1: 3,
    otherAccount2: 4,
    communityGrant: 5,
    client1: 6,
    client2: 7,
    client3: 8,
    client4: 9,
    client5: 10,
    client6: 11,
    client7: 12,
    client8: 13,
    client9: 14,
    client10: 15,
    client1Account1: 16,
    client1Account2: 17,
    client2Account1: 18,
    client2Account2: 19,
    client3Account1: 20,
    client3Account2: 21,
    communityGrantAccount1: 22,
    communityGrantAccount2: 23,
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
        accountsBalance: "36000000000000000000000000",
        count: 25,
      },
      chainId: chainIds.hardhat,
    },
    goerli: createTestnetConfig("goerli"),
    kovan: createTestnetConfig("kovan"),
    rinkeby: createTestnetConfig("rinkeby"),
    ropsten: createTestnetConfig("ropsten"),
    sagano: createTestnetConfig("sagano"),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.7.6",
    settings: {
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      evmVersion: "istanbul",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
    alwaysGenerateOverloads: false,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: "USD",
    gasPrice: 21,
  },
  preprocess: {
    eachLine: removeConsoleLog(hre => !["hardhat", "localhost"].includes(hre.network.name)),
  },
  docgen: {
    path: "./docs",
    clear: true,
    runOnCompile: false,
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
    disambiguatePaths: false,
  },
  abiExporter: {
    path: "./abi",
    clear: true,
    flat: false,
    only: [],
    spacing: 2,
  },
};

export default config;
