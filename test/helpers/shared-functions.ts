/// @note  This files contatins all the functions and data structure shared among the tests

import { BigNumber, Signer, ContractTransaction } from "ethers";
import { ethers, getNamedAccounts } from "hardhat";
import { Treasury } from "../../typechain";
import { ONE_BASE18, ONE_HUNDRED_BASE18, ZERO_ADDRESS } from "./constants";
import { expect } from "chai";

/// @note Improves readability
type Address = string;

/// @note Data structure to store the calculated Values to expect in the test cases
interface Values {
  COMMUNITY_GRANT_REWARD_PERCENT: number;
  COMM_GRANT_DONATION_VALUE: BigNumber;
  DONATED_VALUE: BigNumber;
  CLIENTS_PERCENTAGE: number;
  CLIENTS_VALUE: BigNumber;
  PERCENTAGE_PER_CLIENT: number;
  VALUE_PER_CLIENT: BigNumber;
}

/// @note Data structure to store members operation along the entire use case
interface Member {
  name: string;
  address: Address;
  withdrawnFunds: BigNumber;
  percentage: BigNumber;
}

/// @note Global structure to compare with the contract's storage
interface GlobalValues {
  totalWithdrawnAmounts: BigNumber;
  totalFundsReceived: BigNumber;
}

/// @note Global structure to compare with the contract's storage
/// @note It's temporal because the test overwrite its value when needed
interface MemberTempporalValues {
  amountToWithdraw: BigNumber;
  memberWithdrawnFunds: BigNumber;
}

/// @note Function to build an Array of Members
function buildMembersData(
  rewardPercent: number,
  qtyClients: number,
  namedAccounts: { [name: string]: Address },
): Member[] {
  if (qtyClients > 10) {
    throw new Error("Cannot put more than 10 clients");
  }

  const {
    communityGrant,
    client1,
    client2,
    client3,
    client4,
    client5,
    client6,
    client7,
    client8,
    client9,
    client10,
  } = namedAccounts;

  const allMemberAddresses = [
    communityGrant,
    client1,
    client2,
    client3,
    client4,
    client5,
    client6,
    client7,
    client8,
    client9,
    client10,
  ];
  const memberAddresses = allMemberAddresses.slice(0, qtyClients + 1);

  const percentageCommGrantBase18 = BigNumber.from(rewardPercent).mul(ONE_BASE18);
  const percentagePerClientBase18 = ONE_HUNDRED_BASE18.sub(percentageCommGrantBase18).div(qtyClients);

  const members: Member[] = new Array(qtyClients + 1);
  members[0] = {
    name: "CommunityGrant",
    address: memberAddresses[0],
    withdrawnFunds: BigNumber.from("0"),
    percentage: percentageCommGrantBase18,
  };

  for (let i = 1; i <= qtyClients; i++) {
    members[i] = {
      name: "client" + i,
      address: memberAddresses[i],
      withdrawnFunds: BigNumber.from("0"),
      percentage: percentagePerClientBase18,
    };
  }
  return members;
}

/// @note Make an invalid deployment so the contract can fail with the expected errors
async function invalidDeployment(
  rewardPercent: BigNumber,
  addressZeroCg: boolean,
  addressZeroCl: boolean,
  duplicatedClient: boolean,
  withClients: boolean,
): Promise<Treasury> {
  const factory = await ethers.getContractFactory("Treasury");
  const { communityGrant, client1, client2 } = await getNamedAccounts();

  let communityGrantTestAddress = communityGrant;
  let client1Address = client1;
  let client2Address = client2;

  /// @note Invalid Community Grant Address
  if (addressZeroCg) communityGrantTestAddress = ZERO_ADDRESS;

  /// @note Invalid Client1 Address
  if (addressZeroCl) client1Address = ZERO_ADDRESS;

  /// @note Duplicated Client Address in array
  if (duplicatedClient) client2Address = client1Address;

  /// @note Deployment with no clients
  let clientNames: string[] = [];

  /// @note Deployment with clients
  let clientAddresses: Address[] = [];
  if (withClients) {
    clientAddresses = [client1Address, client2Address];
    clientNames = ["client1", "client2"];
  }

  /// @note Contract Deployment
  const treasury = (await factory.deploy(
    communityGrantTestAddress,
    rewardPercent,
    clientAddresses,
    clientNames,
  )) as Treasury;
  return treasury as Treasury;
}

/// @note Deployment with custom memers (the percentage is inside each Member)
async function customDeployTreasuryContract(members: Member[]): Promise<Treasury> {
  let clientNames: string[] = [];
  let clientAddresses: Address[] = [];
  let i: number;

  for (i = 1; i < members.length; i++) {
    clientNames = clientNames.concat(members[i].name);
    clientAddresses = clientAddresses.concat(members[i].address);
  }

  const factory = await ethers.getContractFactory("Treasury");
  const treasury = (await factory.deploy(
    members[0].address,
    members[0].percentage,
    clientAddresses,
    clientNames,
  )) as Treasury;
  return treasury as Treasury;
}

/// @note Find a member by its name and return the Member Structure
function findMemberByName(members: Member[], name: string): Member {
  for (let i = 0; i < members.length; i++) {
    if (members[i].name === name) {
      return members[i];
    }
  }
  throw new Error("Member not found");
}

/// @note Calculate the amount to withdraw for a certain member
function calculateAmount(member: Member, totalFundsReceived: BigNumber): BigNumber {
  const theoricalMaxFundsToWithdraw: BigNumber = member.percentage.mul(totalFundsReceived).div(ONE_HUNDRED_BASE18);
  let maxFundsToWithdraw: BigNumber = BigNumber.from(0);

  if (theoricalMaxFundsToWithdraw.gt(member.withdrawnFunds)) {
    maxFundsToWithdraw = theoricalMaxFundsToWithdraw.sub(member.withdrawnFunds);
  }
  return maxFundsToWithdraw;
}

/// @note Verify the if the Event was emitted properly
async function verifyFundsTransferredEmittedEvent(
  treasuryContract_: Treasury,
  arg1Emitted: string,
  arg2Emitted: string,
  arg3Emitted: BigNumber,
  txResult: ContractTransaction,
): Promise<void> {
  await expect(txResult).to.emit(treasuryContract_, "FundsTransferred").withArgs(arg1Emitted, arg2Emitted, arg3Emitted);
}

/// @note Verify the member variable withdrawnFunds in a given Member
async function verifyMemberWithdrawnFunds(
  treasuryContract_: Treasury,
  memberAddress: string,
  amount: BigNumber,
): Promise<void> {
  const member = await treasuryContract_.members(memberAddress);
  expect(member.withdrawnFunds).to.equal(amount);
}

/// @note Verify the contract variable totalWithdrawnFunds
async function verifyTotalWithdrawnFunds(treasuryContract_: Treasury, amount: BigNumber): Promise<void> {
  const totalWithdrawnFunds = await treasuryContract_.totalWithdrawnFunds();
  expect(totalWithdrawnFunds).to.equal(amount);
}

/// @note Verify the balance change of an account
async function verifyBalance(txResult_: ContractTransaction, signedAccount: Signer, amount: BigNumber): Promise<void> {
  await expect(txResult_).to.changeEtherBalance(signedAccount, amount);
}

/// @note Various operations to update the global variables an the member structure in the tests
function withDrawUpdatesOperations(
  memberToSearch: string,
  members: Member[],
  globalValues: GlobalValues,
  memberValues: MemberTempporalValues,
): void {
  const member = findMemberByName(members, memberToSearch);
  memberValues.amountToWithdraw = calculateAmount(member, globalValues.totalFundsReceived);
  member.withdrawnFunds = member.withdrawnFunds.add(memberValues.amountToWithdraw);
  memberValues.memberWithdrawnFunds = member.withdrawnFunds;
  globalValues.totalWithdrawnAmounts = globalValues.totalWithdrawnAmounts.add(memberValues.amountToWithdraw);
}

/// @note Calculates the expected values for the tests
function calculateValues(communityGrantPercent: number, donation: BigNumber, qtyClients: number): Values {
  const commGrantDonationValue = donation.mul(BigNumber.from(communityGrantPercent)).div(BigNumber.from("100"));
  const totalClientsPercent = 100 - communityGrantPercent;
  const totalClientsValue = BigNumber.from(donation).sub(commGrantDonationValue);

  const values: Values = {
    COMMUNITY_GRANT_REWARD_PERCENT: communityGrantPercent,
    COMM_GRANT_DONATION_VALUE: commGrantDonationValue,
    DONATED_VALUE: BigNumber.from(donation),
    CLIENTS_PERCENTAGE: totalClientsPercent,
    CLIENTS_VALUE: totalClientsValue,
    PERCENTAGE_PER_CLIENT: (100 - communityGrantPercent) / qtyClients,
    VALUE_PER_CLIENT: totalClientsValue.div(qtyClients),
  };

  return values;
}

/// @note Prints each member data structure. Just for debbuging purposes
function printMembers(members: Member[]): void {
  for (let i = 0; i < members.length; i++) {
    console.log("\nmembers[i].name           :>> ", members[i].name);
    console.log("members[i].address        :>> ", members[i].address);
    console.log("members[i].percentage     :>> ", members[i].percentage.toString());
    console.log("members[i].withdrawnFunds :>> ", members[i].withdrawnFunds.toString());
  }
}

export {
  buildMembersData,
  findMemberByName,
  calculateAmount,
  invalidDeployment,
  customDeployTreasuryContract,
  verifyFundsTransferredEmittedEvent,
  verifyMemberWithdrawnFunds,
  verifyTotalWithdrawnFunds,
  verifyBalance,
  withDrawUpdatesOperations,
  Member,
  GlobalValues,
  MemberTempporalValues,
  calculateValues,
  printMembers,
};
