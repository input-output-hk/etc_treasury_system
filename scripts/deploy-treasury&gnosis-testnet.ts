/// @note This Script will perform the following actions:
/// @note Deploy the Proxy, MasterCopy and Safe Contract for Multisig
/// @note Deploy the treasury using the multisig as Community Grant and 2 clients
/// @note Create a Multisig Transaction and sign it with allowed addresses
/// @note Execute Whitelist Transaction for Community Grant Multisig address to be able to withdraw
/// @note Send a donation to the contract
/// @note Create a Whitdraw Transaction and sign it
/// @note Execute the Whitdraw Transaction to get the corresponding part for Community Grant (using multisig)
/// @note Check Contract Balance
/// @note Check Multisig Balance

/// @note IMPORTANT NOTE: For this script to work the following NAMED ACCOUNTS must have ETC to pay gas");
/// @note - donator
/// @note - deployer
/// @note - communityGrant
/// @note - communityGrantAccount2
/// @note - and the Safe contract which will be funded from donator account
/// @note - For the Sagano/Mantis ETC Fawcet go to:
/// @note - https://mantis-testnet-faucet-web.mantis.ws/

/// @note The code is written in the deployContractsAndExecuteTransactions function as a step by step mode
/// @note to make it easier to follow

import { GnosisSafeTest, GnosisSafeProxyFactoryTest, Treasury } from "../typechain";
import { waffle, ethers, getNamedAccounts } from "hardhat";
import { Event } from "ethers";
import { ZERO_ADDRESS } from "../test/helpers/constants";
import EthersSafe from "@gnosis.pm/safe-core-sdk";
import { BigNumber } from "@ethersproject/bignumber";
import { ONE_BASE18 } from "../test/helpers/constants";

let contractNetworks: { [x: number]: { multiSendAddress: string } };

/// @note Deploy the Proxy to spawn the Gnosis Safe
async function deployGnosisProxy() {
  const factoryProxy = await ethers.getContractFactory("GnosisSafeProxyFactoryTest");
  const proxyFactory = (await factoryProxy.deploy()) as GnosisSafeProxyFactoryTest;
  await proxyFactory.deployTransaction.wait();
  return proxyFactory as GnosisSafeProxyFactoryTest;
}

/// @note Deploy the master copy of the Gnosis Safe
async function deployGnosisMasterContract() {
  const factorySafe = await ethers.getContractFactory("GnosisSafeTest");
  const gnosisSafeMasterCopy = (await factorySafe.deploy()) as GnosisSafeTest;
  await gnosisSafeMasterCopy.deployTransaction.wait();
  return gnosisSafeMasterCopy as GnosisSafeTest;
}

/// @note Set the contractNetworks global variable
async function setContractNetworks(gnosisContractAddress: string) {
  const idChain = (await waffle.provider.getNetwork()).chainId;
  return {
    [idChain]: {
      multiSendAddress: gnosisContractAddress,
    },
  };
}

/// @note Deploy the actual contract to interact with
async function deployGnosisSafe(
  multisigOwners: string[],
  qtyToExecute: number,
  gnosisSafeMasterCopy: GnosisSafeTest,
  proxyFactory: GnosisSafeProxyFactoryTest,
) {
  const gnosisSafeData = gnosisSafeMasterCopy.interface.encodeFunctionData("setup", [
    multisigOwners,
    qtyToExecute,
    ZERO_ADDRESS,
    "0x",
    ZERO_ADDRESS,
    ZERO_ADDRESS,
    0,
    ZERO_ADDRESS,
  ]);
  const tx = await proxyFactory.createProxy(gnosisSafeMasterCopy.address, gnosisSafeData);
  const txReceipt = await tx.wait();
  let contractAddress;
  let events: Event[];
  if (txReceipt && txReceipt.events) {
    events = txReceipt.events.filter(obj => obj.event === "ProxyCreation" && obj.address === proxyFactory.address);
  } else {
    throw new Error("Error deploying Safe Contract");
  }
  if (events[0].args && events[0].args["proxy"]) {
    contractAddress = events[0].args && events[0].args["proxy"];
  } else {
    throw new Error("Error getting Safe Contract Address");
  }
  const factorySafe = await ethers.getContractFactory("GnosisSafeTest");
  return factorySafe.attach(contractAddress);
}

async function deployGnosisSafeInTestnet(
  communityGrant: string,
  communityGrantAccount1: string,
  communityGrantAccount2: string,
): Promise<EthersSafe> {
  const signedCommunityGrant = await ethers.getSigner(communityGrant);
  const proxyFactory = await deployGnosisProxy();
  const gnosisSafeMasterCopy = await deployGnosisMasterContract();

  /// @note deploy a multisig for community grant with a thershold of 2 to execute a transaction
  const ownersMsigCommGrant = [communityGrant, communityGrantAccount1, communityGrantAccount2];

  const multisigCommGrant = await deployGnosisSafe(ownersMsigCommGrant, 2, gnosisSafeMasterCopy, proxyFactory);
  contractNetworks = await setContractNetworks(multisigCommGrant.address);
  const safeInstanceSignedCommGrant = await EthersSafe.create({
    ethers,
    safeAddress: multisigCommGrant.address,
    providerOrSigner: signedCommunityGrant,
    contractNetworks,
  });
  /// @note Get safe addresses
  const safeCommGrantAddress = safeInstanceSignedCommGrant.getAddress();

  console.log("\nProxyFactory Deployed At      :>> ", proxyFactory.address);
  console.log("Gnosis MasterCopy Deployed At :>> ", gnosisSafeMasterCopy.address);
  console.log("Gnosis Safe Deployed At       :>> ", safeCommGrantAddress);
  console.log("Allowed Addresses :>> ", ownersMsigCommGrant, "\n");

  return safeInstanceSignedCommGrant;
}

async function deployTreasuryInTestnet(multisigCommGrant: string, client1: string, client2: string): Promise<Treasury> {
  const REWARD_PERCENT = BigNumber.from("10000000000000000000");

  const clientAddresses = [client1, client2];
  const clientNames = ["client1", "client2"];
  const factoryTresury = await ethers.getContractFactory("Treasury");
  const treasury = (await factoryTresury.deploy(
    multisigCommGrant,
    REWARD_PERCENT,
    clientAddresses,
    clientNames,
  )) as Treasury;
  await treasury.deployTransaction.wait();

  console.log("\n    Treasury deployed at: ", treasury.address);
  console.log(`    With ${clientNames.length} Clients`);
  console.log("     ", clientAddresses);
  console.log("     Community Grant Multisig Address: ", multisigCommGrant);
  console.log("     Reward Percent: %", REWARD_PERCENT.toString());

  return treasury as Treasury;
}

async function deployContractsAndExecuteTransactions() {
  console.log("\n\n==========================================================================\n");
  console.log("This Script will perform the following actions:\n");
  console.log("- Deploy the Proxy, MasterCopy and Safe Contract for Multisig");
  console.log("- Deploy the treasury using the multisig as Community Grant and 2 clients");
  console.log("- Create a Multisig Transaction and sign it with allowed addresses");
  console.log("- Execute Whitelist Transaction for Community Grant Multisig address to be able to withdraw");
  console.log("- Send a donation to the contract");
  console.log("- Create a Whitdraw Transaction and sign it");
  console.log("- Execute the Whitdraw transaction to get the corresponding part for Community Grant (using multisig)");
  console.log("- Check Contract Balance");
  console.log("- Check Multisig Balance\n\n");
  console.log("IMPORTANT NOTE: For this script to work the following NAMED ACCOUNTS must have ETC to pay gas\n");
  console.log("- donator");
  console.log("- deployer");
  console.log("- communityGrant");
  console.log("- communityGrantAccount2");
  console.log("- and the Safe contract which will be funded from donator account\n");
  console.log("For the Sagano/Mantis ETC Fawcet go to:");
  console.log("https://mantis-testnet-faucet-web.mantis.ws\n");
  console.log("==========================================================================\n");

  const namedAccounts = await getNamedAccounts();

  console.log("\nDeploying Multisig Contracts");
  const safeInstance = await deployGnosisSafeInTestnet(
    namedAccounts.communityGrant,
    namedAccounts.communityGrantAccount1,
    namedAccounts.communityGrantAccount2,
  );
  const safeCommGrantAddress = safeInstance.getAddress();

  console.log("\nDeploying Treasury Contract");
  const treasury = await deployTreasuryInTestnet(safeCommGrantAddress, namedAccounts.client1, namedAccounts.client2);

  console.log("\n\nCreating the Whitelist Transaction...");
  const whitelistData = treasury.interface.encodeFunctionData("addToWhitelist", [safeCommGrantAddress]);
  let transactions = [
    {
      to: treasury.address,
      value: "0",
      data: whitelistData,
    },
  ];
  let safeTransaction = await safeInstance.createTransaction(...transactions);

  console.log("\nSigning the Whitelist transaction...");
  await safeInstance.signTransaction(safeTransaction);

  /// @note get signer to later execute/sign the transaction
  const signedCommunityGrantAccount2 = await ethers.getSigner(namedAccounts.communityGrantAccount2);

  const safeInstanceSign2 = await safeInstance.connect({
    providerOrSigner: signedCommunityGrantAccount2,
    safeAddress: safeCommGrantAddress,
    contractNetworks,
  });

  console.log("\nExecuting/Signing the transaction...");
  /// @note Execute transaction (implicit approval)
  let txResponse = await safeInstanceSign2.executeTransaction(safeTransaction);
  await txResponse.wait();

  console.log("\nChecking whitelist address...");
  const contractMemberAddress = await treasury.authorizedAddresses(safeCommGrantAddress);
  if (contractMemberAddress != safeCommGrantAddress) {
    throw new Error("Error when whitelisting multisig address");
  }

  let contractBalance = await treasury.getContractBalance();
  console.log("\nContract Balance is:              ", contractBalance.toString());

  const donator = await ethers.getSigner(namedAccounts.donator);
  const DONATED_VALUE = ONE_BASE18.div(10); // 0.1 ETHER

  console.log("\nFunding Multisig Contract with:   ", DONATED_VALUE.toString());
  txResponse = await donator.sendTransaction({ to: safeCommGrantAddress, value: DONATED_VALUE });
  await txResponse.wait();

  console.log("\nContract Receiving a Donation of: ", DONATED_VALUE.toString());
  txResponse = await donator.sendTransaction({ to: treasury.address, value: DONATED_VALUE });
  await txResponse.wait();

  contractBalance = await treasury.getContractBalance();
  console.log("\nContract Balance is:              ", contractBalance.toString());

  if (contractBalance.toString() != DONATED_VALUE.toString()) {
    throw new Error("Error when receiveing donation");
  }

  console.log("\nCreating the Whitdraw Transaction...");
  const withdrawData = treasury.interface.encodeFunctionData("withdrawFunds");
  transactions = [
    {
      to: treasury.address,
      value: "0",
      data: withdrawData,
    },
  ];
  safeTransaction = await safeInstance.createTransaction(...transactions);

  console.log("\nSigning the Withdraw transaction");
  await safeInstance.signTransaction(safeTransaction);

  console.log("\nExecuting/Signing the Withdraw transaction...");
  txResponse = await safeInstanceSign2.executeTransaction(safeTransaction);
  await txResponse.wait();

  contractBalance = await treasury.getContractBalance();
  console.log("\nContract Balance is:              ", contractBalance.toString());

  const multisigBalance = await safeInstance.getBalance();
  console.log("\nMultisigBalance Balance is:       ", multisigBalance.toString());

  console.log("\n ===>> Script Finished - Bye !!");
}

deployContractsAndExecuteTransactions()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
