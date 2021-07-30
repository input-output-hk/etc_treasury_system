/// @note These tests are tied together to build most of the operations to be done with the
/// @note treasury contract. All of them conform various user cases where several
/// @note donations and withdrawal operations take place. Removing one describe can break
/// @note the flow.
/// @note The test are tied to the functions on helpers/shared-functions.ts.
/// @note Those functions copy the same functionality as the Smart Contract to do the calculations.
/// @note Also, the value 888888888888888888888 as a donated amount was on purpose to show
/// @note it does not matter the leftover decimals or wei. In the long run every wei is
/// @note distributed and equally distributed between each member

import { ethers, getNamedAccounts } from "hardhat";
import {
  customDeployTreasuryContract,
  buildMembersData,
  Member,
  GlobalValues,
  MemberTempporalValues,
  verifyFundsTransferredEmittedEvent,
  verifyMemberWithdrawnFunds,
  verifyTotalWithdrawnFunds,
  verifyBalance,
  withDrawUpdatesOperations,
} from "./helpers/shared-functions";
import { expect } from "chai";
import { Treasury } from "../typechain";
import { Signer } from "ethers";
import { ContractTransaction } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";

describe("Feature: Treasury Withdraw Funds calculations by program", () => {
  let namedAccounts: { [name: string]: string };
  let donator: Signer;

  let signedCommunityGrant: Signer;
  let signedCommunityGrantAccount1: Signer;
  let signedCommunityGrantAccount2: Signer;

  let signedClient1: Signer;
  let signedClient2: Signer;

  let signedClient1Account1: Signer;
  let signedClient1Account2: Signer;
  let signedClient2Account1: Signer;
  let signedClient2Account2: Signer;

  let txResult: ContractTransaction;

  let members: Member[];

  const globalValues: GlobalValues = {
    totalWithdrawnAmounts: BigNumber.from(0),
    totalFundsReceived: BigNumber.from(0),
  };
  const memberValues: MemberTempporalValues = {
    amountToWithdraw: BigNumber.from(0),
    memberWithdrawnFunds: BigNumber.from(0),
  };

  before(async function () {
    namedAccounts = await getNamedAccounts();
    donator = await ethers.getSigner(namedAccounts.donator);

    signedCommunityGrant = await ethers.getSigner(namedAccounts.communityGrant);
    signedCommunityGrantAccount1 = await ethers.getSigner(namedAccounts.communityGrantAccount1);
    signedCommunityGrantAccount2 = await ethers.getSigner(namedAccounts.communityGrantAccount2);

    signedClient1 = await ethers.getSigner(namedAccounts.client1);
    signedClient1Account1 = await ethers.getSigner(namedAccounts.client1Account1);
    signedClient1Account2 = await ethers.getSigner(namedAccounts.client1Account2);

    signedClient2 = await ethers.getSigner(namedAccounts.client2);
    signedClient2Account1 = await ethers.getSigner(namedAccounts.client2Account1);
    signedClient2Account2 = await ethers.getSigner(namedAccounts.client2Account2);
  });

  describe("GIVEN a contract with four clients and 15% Community Reward", function () {
    const REWARD_PERCENT = 15;
    const CLIENTS_QTY = 4;
    const DONATED_VALUE = BigNumber.from("888888888888888888888");

    let treasuryContract: Treasury;
    let signedTreasuryAddress: Signer;

    before(async function () {
      members = buildMembersData(REWARD_PERCENT, CLIENTS_QTY, namedAccounts);
      treasuryContract = await customDeployTreasuryContract(members);
    });

    describe("GIVEN 2 whitelisted addresses per member", function () {
      before(async function () {
        await treasuryContract.connect(signedCommunityGrant).addToWhitelist(namedAccounts.communityGrantAccount1);
        await treasuryContract.connect(signedCommunityGrant).addToWhitelist(namedAccounts.communityGrantAccount2);
        await treasuryContract.connect(signedClient1).addToWhitelist(namedAccounts.client1Account1);
        await treasuryContract.connect(signedClient1).addToWhitelist(namedAccounts.client1Account2);
        await treasuryContract.connect(signedClient2).addToWhitelist(namedAccounts.client2Account1);
        await treasuryContract.connect(signedClient2).addToWhitelist(namedAccounts.client2Account2);

        signedTreasuryAddress = await ethers.getSigner(treasuryContract.address);
      });

      describe(`WHEN receiving a donation of ${DONATED_VALUE}`, function () {
        before(async function () {
          txResult = await donator.sendTransaction({ to: treasuryContract.address, value: DONATED_VALUE });
          globalValues.totalFundsReceived = globalValues.totalFundsReceived.add(DONATED_VALUE);
        });

        it("THEN a ReceivedFunds event should be emitted", async function () {
          await expect(txResult)
            .to.emit(treasuryContract, "ReceivedFunds")
            .withArgs(namedAccounts.donator, DONATED_VALUE);
        });

        it(`THEN the Contract Balance should be ${DONATED_VALUE}`, async function () {
          return verifyBalance(txResult, signedTreasuryAddress, DONATED_VALUE);
        });

        describe("WHEN a Community Grant account withdraws funds", function () {
          before(async function () {
            txResult = await treasuryContract.connect(signedCommunityGrantAccount1).withdrawFunds();
            withDrawUpdatesOperations("CommunityGrant", members, globalValues, memberValues);
          });

          it("THEN a FundsTransferred event should be emitted", async function () {
            return verifyFundsTransferredEmittedEvent(
              treasuryContract,
              namedAccounts.communityGrantAccount1,
              namedAccounts.communityGrant,
              memberValues.amountToWithdraw,
              txResult,
            );
          });

          it(`THEN Contract Balance should be DECREASED by the withdraw amount`, async function () {
            const difference = memberValues.amountToWithdraw.mul(-1);
            return verifyBalance(txResult, signedTreasuryAddress, difference);
          });

          it(`THEN Community Grant account should receive the ${REWARD_PERCENT}% of ${DONATED_VALUE}`, async function () {
            return verifyBalance(txResult, signedCommunityGrantAccount1, memberValues.amountToWithdraw);
          });

          it(`THEN Community Grant withdrawnFunds amount should be INCREASED by the withdraw amount`, async function () {
            return verifyMemberWithdrawnFunds(
              treasuryContract,
              namedAccounts.communityGrant,
              memberValues.memberWithdrawnFunds,
            );
          });

          it(`THEN totalWithdrawnFunds should be INCREASED by the withdraw amount`, async function () {
            return verifyTotalWithdrawnFunds(treasuryContract, globalValues.totalWithdrawnAmounts);
          });
        });

        describe(`WHEN a Client 1 account withdraws funds`, function () {
          before(async function () {
            txResult = await treasuryContract.connect(signedClient1Account1).withdrawFunds();
            withDrawUpdatesOperations("client1", members, globalValues, memberValues);
          });

          it("THEN a FundsTransferred event should be emitted", async function () {
            return verifyFundsTransferredEmittedEvent(
              treasuryContract,
              namedAccounts.client1Account1,
              namedAccounts.client1,
              memberValues.amountToWithdraw,
              txResult,
            );
          });

          it(`THEN Contract Balance should be DECREASED by the withdraw amount`, async function () {
            const difference = memberValues.amountToWithdraw.mul(-1);
            return verifyBalance(txResult, signedTreasuryAddress, difference);
          });

          it(`THEN Client 1 account should receive the withdraw amount`, async function () {
            return verifyBalance(txResult, signedClient1Account1, memberValues.amountToWithdraw);
          });

          it(`THEN Client 1 withdrawnFunds amount should be INCREASED by the withdraw amount`, async function () {
            return verifyMemberWithdrawnFunds(
              treasuryContract,
              namedAccounts.client1,
              memberValues.memberWithdrawnFunds,
            );
          });

          it(`THEN totalWithdrawnFunds should be INCREASED by the withdraw amount`, async function () {
            return verifyTotalWithdrawnFunds(treasuryContract, globalValues.totalWithdrawnAmounts);
          });
        });

        describe("WHEN another Client 1 account tries to withdraw funds", function () {
          it("THEN the transaction should revert", async function () {
            await expect(treasuryContract.connect(signedClient1Account2).withdrawFunds()).to.be.revertedWith(
              "There are NO pending funds to withdraw for the caller-member",
            );
          });
        });

        describe(`WHEN receiving another a donation of ${DONATED_VALUE}`, function () {
          before(async function () {
            txResult = await donator.sendTransaction({ to: treasuryContract.address, value: DONATED_VALUE });
            globalValues.totalFundsReceived = globalValues.totalFundsReceived.add(DONATED_VALUE);
          });

          it(`THEN the Contract Balance should be INCREASED by ${DONATED_VALUE}`, async function () {
            return verifyBalance(txResult, signedTreasuryAddress, DONATED_VALUE);
          });

          describe("WHEN another Community Grant account withdraws funds", function () {
            before(async function () {
              txResult = await treasuryContract.connect(signedCommunityGrantAccount2).withdrawFunds();
              withDrawUpdatesOperations("CommunityGrant", members, globalValues, memberValues);
            });

            it("THEN a FundsTransferred event should be emitted", async function () {
              return verifyFundsTransferredEmittedEvent(
                treasuryContract,
                namedAccounts.communityGrantAccount2,
                namedAccounts.communityGrant,
                memberValues.amountToWithdraw,
                txResult,
              );
            });

            it(`THEN Contract Balance should be DECREASED by the withdraw amount`, async function () {
              const difference = memberValues.amountToWithdraw.mul(-1);
              return verifyBalance(txResult, signedTreasuryAddress, difference);
            });

            it(`THEN Community Grant account should receive the withdraw amount`, async function () {
              return verifyBalance(txResult, signedCommunityGrantAccount2, memberValues.amountToWithdraw);
            });

            it(`THEN Community Grant withdrawnFunds amount should be INCREASED by the withdraw amount`, async function () {
              return verifyMemberWithdrawnFunds(
                treasuryContract,
                namedAccounts.communityGrant,
                memberValues.memberWithdrawnFunds,
              );
            });

            it(`THEN totalWithdrawnFunds should be INCREASED by the withdraw amount`, async function () {
              return verifyTotalWithdrawnFunds(treasuryContract, globalValues.totalWithdrawnAmounts);
            });
          });

          describe("WHEN another Community Grant account tries to withdraw funds", function () {
            it("THEN the transaction should revert", async function () {
              await expect(treasuryContract.connect(signedCommunityGrantAccount1).withdrawFunds()).to.be.revertedWith(
                "There are NO pending funds to withdraw for the caller-member",
              );
            });
          });

          describe(`WHEN another Client 1 account withdraws funds`, function () {
            before(async function () {
              txResult = await treasuryContract.connect(signedClient1Account2).withdrawFunds();
              withDrawUpdatesOperations("client1", members, globalValues, memberValues);
            });

            it("THEN a FundsTransferred event should be emitted", async function () {
              return verifyFundsTransferredEmittedEvent(
                treasuryContract,
                namedAccounts.client1Account2,
                namedAccounts.client1,
                memberValues.amountToWithdraw,
                txResult,
              );
            });

            it(`THEN Contract Balance should be DECREASED by the withdraw amount`, async function () {
              const difference = memberValues.amountToWithdraw.mul(-1);
              return verifyBalance(txResult, signedTreasuryAddress, difference);
            });

            it(`THEN Client 1 account should receive the withdraw amount`, async function () {
              return verifyBalance(txResult, signedClient1Account2, memberValues.amountToWithdraw);
            });

            it(`THEN Client 1 withdrawnFunds amount should be INCREASED by the withdraw amount`, async function () {
              return verifyMemberWithdrawnFunds(
                treasuryContract,
                namedAccounts.client1,
                memberValues.memberWithdrawnFunds,
              );
            });

            it(`THEN totalWithdrawnFunds should be INCREASED by the withdraw amount`, async function () {
              return verifyTotalWithdrawnFunds(treasuryContract, globalValues.totalWithdrawnAmounts);
            });
          });

          describe(`WHEN Client 2 account withdraws funds`, function () {
            before(async function () {
              txResult = await treasuryContract.connect(signedClient2Account1).withdrawFunds();
              withDrawUpdatesOperations("client2", members, globalValues, memberValues);
            });

            it("THEN a FundsTransferred event should be emitted", async function () {
              return verifyFundsTransferredEmittedEvent(
                treasuryContract,
                namedAccounts.client2Account1,
                namedAccounts.client2,
                memberValues.amountToWithdraw,
                txResult,
              );
            });

            it(`THEN Contract Balance should be DECREASED by the withdraw amount`, async function () {
              const difference = memberValues.amountToWithdraw.mul(-1);
              return verifyBalance(txResult, signedTreasuryAddress, difference);
            });

            it(`THEN Client 2 account should receive the withdraw amount`, async function () {
              return verifyBalance(txResult, signedClient2Account1, memberValues.amountToWithdraw);
            });

            it(`THEN Client 2 withdrawnFunds amount should be INCREASED by the withdraw amount`, async function () {
              return verifyMemberWithdrawnFunds(
                treasuryContract,
                namedAccounts.client2,
                memberValues.memberWithdrawnFunds,
              );
            });

            it(`THEN totalWithdrawnFunds should be INCREASED by the withdraw amount`, async function () {
              return verifyTotalWithdrawnFunds(treasuryContract, globalValues.totalWithdrawnAmounts);
            });

            describe("WHEN another Client 2 account tries to withdraw funds", function () {
              it("THEN the transaction should revert", async function () {
                await expect(treasuryContract.connect(signedClient2Account2).withdrawFunds()).to.be.revertedWith(
                  "There are NO pending funds to withdraw for the caller-member",
                );
              });
            });

            describe(`WHEN querying the contract balance`, function () {
              it("THEN it should return the balance", async function () {
                const expectedContractBalance = globalValues.totalFundsReceived.sub(globalValues.totalWithdrawnAmounts);
                const contractBalance = BigNumber.from(await treasuryContract.getContractBalance());
                return expect(expectedContractBalance).to.equal(contractBalance);
              });
            });
          });
        });
      });
    });
  });
});
