import { getChainId } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { BigNumber } from "@ethersproject/bignumber";
import { populateDeploy } from "../deploy.config";

/// @note this modules validates an ETC address
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WAValidator = require("wallet-validator");

const ONE_BASE18 = BigNumber.from(BigNumber.from(10).pow(18));
const ONE_HUNDRED_BASE18 = BigNumber.from(ONE_BASE18.mul(100)); // 100

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments } = hre;
  const { deploy } = deployments;

  const currentChainId = await getChainId();
  const deployConfig = await populateDeploy();

  const deployerAddress = deployConfig[currentChainId].DEPLOYMENT.DEPLOYER_ADDRESS;
  const commGrantAddress = deployConfig[currentChainId].DEPLOYMENT.COMM_GRANT_ADDRESS;
  const commGrantRewardPercent = BigNumber.from(deployConfig[currentChainId].DEPLOYMENT.COMM_GRANT_REWARD_PERCENT);
  const envClientNamesArray = deployConfig[currentChainId].DEPLOYMENT.CLIENTS_NAMES_ARRAY;
  const envClientAddressesArray = deployConfig[currentChainId].DEPLOYMENT.CLIENTS_ADDRESSES_ARRAY;

  const clientAddressesArray = envClientAddressesArray.split(",");
  const clientNamesArray = envClientNamesArray.split(",");

  if (commGrantRewardPercent.lt(ONE_BASE18)) {
    throw new Error("Community Grant Reward Percent should be at least than 1% => (1000000000000000000)");
  }

  if (commGrantRewardPercent.gt(ONE_HUNDRED_BASE18)) {
    throw new Error("Community Grant Reward Percent cannot be higher than 100% => (100000000000000000000)");
  }

  let valid = WAValidator.validate(commGrantAddress, "ethereumclassic");
  if (!valid) {
    throw new Error("INVALID Address for Community Grant");
  }

  if (clientAddressesArray.length < 1) {
    throw new Error("There are no Addresses defined in the array!");
  }

  if (clientNamesArray.length < 1) {
    throw new Error("There are no Names defined in the array");
  }

  if (clientAddressesArray.length != clientNamesArray.length) {
    throw new Error("There are different quantity of Clients Addressess and Client Names!");
  }

  let msg = "";
  for (let i = 0; i < clientAddressesArray.length; i++) {
    if (clientNamesArray[i] == "") {
      msg = "EMPTY Name for Client position: " + i;
      throw new Error(msg);
    }

    valid = WAValidator.validate(clientAddressesArray[i], "ethereumclassic");
    if (!valid) {
      msg = "INVALID Address for Client: " + clientNamesArray[i];
      throw new Error(msg);
    }
  }

  const deployResult = await deploy("Treasury", {
    from: deployerAddress,
    gasLimit: 4000000,
    args: [commGrantAddress, commGrantRewardPercent, clientAddressesArray, clientNamesArray],
  });
  console.log("\n    Treasury deployed at: ", deployResult.address);
  console.log("    Transaction  hash at: ", deployResult.transactionHash);
  console.log(`    With ${clientNamesArray.length} Clients`);
  console.log("     ", clientAddressesArray);
  console.log("     Community Grant Address: ", commGrantAddress);
  console.log("     Reward Percent: %", commGrantRewardPercent.toString());
  console.log("     Contract deployed By: ", deployerAddress, "\n");

  return hre.network.live; // prevents re execution on live networks
};
export default deployFunc;
deployFunc.id = "deploy_treasury"; // id required to prevent reexecution
