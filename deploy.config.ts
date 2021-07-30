import { getNamedAccounts } from "hardhat";

interface DeployConfig {
  DEPLOYMENT: {
    DEPLOYER_ADDRESS: string;
    COMM_GRANT_REWARD_PERCENT: string;
    COMM_GRANT_ADDRESS: string;
    CLIENTS_ADDRESSES_ARRAY: string;
    CLIENTS_NAMES_ARRAY: string;
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
async function populateDeploy() {
  const namedAccounts = await getNamedAccounts();
  interface IDictionary {
    [index: string]: DeployConfig;
  }
  let deployConfig = {} as IDictionary;

  /// @note Sagano network returns 42 as Chain ID and Kovan as Network Name !!
  deployConfig = {
    "42": {
      DEPLOYMENT: {
        DEPLOYER_ADDRESS: "0xab5013298c85d0E024C566B3ae46033D1f447D4e",
        COMM_GRANT_REWARD_PERCENT: "15000000000000000000",
        // COMM_GRANT_ADDRESS: "0x8ae6977E3C31E7249bAFBfc8aeB2fAf8f4b25308",
        COMM_GRANT_ADDRESS: "0x622D544CF8597443e9412b61879e8ecf0a01AEb1",
        CLIENTS_ADDRESSES_ARRAY:
          "0xBf092095C0fEe00AaEeaE1f5aE78e89E8a1C44dc,0xa327fDCF5287a2172C27C949A2d59A17E432fC1B",
        CLIENTS_NAMES_ARRAY: "client1,client2",
      },
    },
    "31337": {
      DEPLOYMENT: {
        DEPLOYER_ADDRESS: namedAccounts.deployer,
        COMM_GRANT_REWARD_PERCENT: "10000000000000000000",
        COMM_GRANT_ADDRESS: namedAccounts.communityGrant,
        CLIENTS_ADDRESSES_ARRAY: namedAccounts.client1 + "," + namedAccounts.client2 + "," + namedAccounts.client3,
        CLIENTS_NAMES_ARRAY: "client1,client2,client3",
      },
    },
  };

  return deployConfig;
}

export { populateDeploy };
