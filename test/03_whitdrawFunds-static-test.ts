/// @note These tests are tied together to build most of the operations to be done with the
/// @note treasury contract. All of them coform various user cases where several
/// @note donations and withdrawal operations take place. Removing one describe can break
/// @note the flow.
/// @note The difference between these tests and the prog-test suffix files (ex. 04_whitdrawFunds-prog-test.ts)
/// @note is that in this file, the values are hardcoded and expected as such. In the prog-test suffix files
/// @note the calculations and global variables among the file work exactly as in the Smart Contract with the
/// @note helpers/shared-functions.ts file.

import { waffle, ethers, getNamedAccounts } from "hardhat";
import { fixtureDeployScript } from "./helpers/common-fixtures";
import { expect } from "chai";
import { Treasury } from "../typechain";
import { Signer } from "ethers";
import { ContractTransaction } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { ONE_HUNDRED_BASE18 } from "./helpers/constants";
import { calculateValues } from "./helpers/shared-functions";
const { loadFixture } = waffle;

describe("Feature: Treasury Withdraw Funds calculations with static expected values", () => {
  const THREE_CLIENTS = 3;
  let namedAccounts: { [name: string]: string };
  let donator: Signer;
  let communityGrant: string;
  let signedCommunityGrant: Signer;
  let communityGrantAccount1: string;
  let communityGrantAccount2: string;
  let signedCommunityGrantAccount1: Signer;
  let signedCommunityGrantAccount2: Signer;
  let signedClient1: Signer;
  let signedClient2: Signer;
  let signedClient3: Signer;
  let signedClient1Account1: Signer;
  let signedClient1Account2: Signer;
  let signedClient2Account1: Signer;
  let signedClient2Account2: Signer;
  let client1Account1: string;
  let client1Account2: string;
  let client2Account1: string;
  let client2Account2: string;
  let client3Account1: string;
  let client3Account2: string;
  let signedOtherAccount: Signer;
  let txResult: ContractTransaction;

  const verifyFundsTransferredEmittedEvent = async (
    treasuryContract_: Treasury,
    arg1Emitted: string,
    arg2Emitted: string,
    arg3Emitted: BigNumber,
  ) => {
    await expect(txResult)
      .to.emit(treasuryContract_, "FundsTransferred")
      .withArgs(arg1Emitted, arg2Emitted, arg3Emitted);
  };

  const verifyMemberWithdrawnFunds = async (treasuryContract_: Treasury, memberAddress: string, amount: BigNumber) => {
    const member = await treasuryContract_.members(memberAddress);
    expect(member.withdrawnFunds).to.equal(amount);
  };

  const verifyTotalWithdrawnFunds = async (treasuryContract_: Treasury, amount: BigNumber) => {
    const totalWithdrawnFunds = await treasuryContract_.totalWithdrawnFunds();
    expect(totalWithdrawnFunds).to.equal(amount);
  };

  const verifyBalance = async (txResult_: ContractTransaction, signedAccount: Signer, amount: BigNumber) => {
    await expect(txResult_).to.changeEtherBalance(signedAccount, amount);
  };

  before(async function () {
    namedAccounts = await getNamedAccounts();
    donator = await ethers.getSigner(namedAccounts.donator);

    communityGrant = namedAccounts.communityGrant;
    signedCommunityGrant = await ethers.getSigner(communityGrant);

    communityGrantAccount1 = namedAccounts.communityGrantAccount1;
    communityGrantAccount2 = namedAccounts.communityGrantAccount2;
    signedCommunityGrantAccount1 = await ethers.getSigner(communityGrantAccount1);
    signedCommunityGrantAccount2 = await ethers.getSigner(communityGrantAccount2);

    client1Account1 = namedAccounts.client1Account1;
    client1Account2 = namedAccounts.client1Account2;

    client2Account1 = namedAccounts.client2Account1;
    client2Account2 = namedAccounts.client2Account2;

    client3Account1 = namedAccounts.client3Account1;
    client3Account2 = namedAccounts.client3Account2;

    signedClient1 = await ethers.getSigner(namedAccounts.client1);
    signedClient2 = await ethers.getSigner(namedAccounts.client2);
    signedClient3 = await ethers.getSigner(namedAccounts.client3);

    signedClient1Account1 = await ethers.getSigner(namedAccounts.client1Account1);
    signedClient1Account2 = await ethers.getSigner(namedAccounts.client1Account2);
    signedClient2Account1 = await ethers.getSigner(namedAccounts.client2Account1);
    signedClient2Account2 = await ethers.getSigner(namedAccounts.client2Account2);

    signedOtherAccount = await ethers.getSigner(namedAccounts.otherAccount1);
  });

  describe("GIVEN a contract with three clients and 10% Community Reward", function () {
    const values = calculateValues(10, ONE_HUNDRED_BASE18, THREE_CLIENTS);
    let treasuryContract: Treasury;
    let signedTreasuryAddress: Signer;

    before(async function () {
      // this fixture executes the deployment script as its default is 3 clients and 10% community grant
      treasuryContract = await loadFixture(fixtureDeployScript);
    });

    describe("GIVEN 2 whitelisted addresses per member", function () {
      before(async function () {
        await treasuryContract.connect(signedCommunityGrant).addToWhitelist(communityGrantAccount1);
        await treasuryContract.connect(signedCommunityGrant).addToWhitelist(communityGrantAccount2);
        await treasuryContract.connect(signedClient1).addToWhitelist(client1Account1);
        await treasuryContract.connect(signedClient1).addToWhitelist(client1Account2);
        await treasuryContract.connect(signedClient2).addToWhitelist(client2Account1);
        await treasuryContract.connect(signedClient2).addToWhitelist(client2Account2);
        await treasuryContract.connect(signedClient3).addToWhitelist(client3Account1);
        await treasuryContract.connect(signedClient3).addToWhitelist(client3Account2);

        signedTreasuryAddress = await ethers.getSigner(treasuryContract.address);
      });

      describe("WHEN a non whitelisted address tries to withdraw funds", function () {
        it("THEN the transaction should revert", async function () {
          await expect(treasuryContract.connect(signedOtherAccount).withdrawFunds()).to.be.revertedWith(
            "Address is not whitelisted",
          );
        });
      });

      describe("WHEN there are no funds to withdraw", function () {
        it("THEN the transaction should revert", async function () {
          await expect(treasuryContract.connect(signedClient1Account1).withdrawFunds()).to.be.revertedWith(
            "There are NO pending funds to withdraw for the caller-member",
          );
        });
      });

      describe(`WHEN receiving a donation of                         ${values.DONATED_VALUE}`, function () {
        before(async function () {
          txResult = await donator.sendTransaction({ to: treasuryContract.address, value: values.DONATED_VALUE });
        });

        it("THEN a ReceivedFunds event should be emitted", async function () {
          await expect(txResult)
            .to.emit(treasuryContract, "ReceivedFunds")
            .withArgs(namedAccounts.donator, values.DONATED_VALUE);
        });

        it(`THEN the Contract Balance should be                      ${values.DONATED_VALUE}`, async function () {
          return verifyBalance(txResult, signedTreasuryAddress, values.DONATED_VALUE);
        });

        describe("WHEN a Community Grant account withdraws funds", function () {
          before(async function () {
            txResult = await treasuryContract.connect(signedCommunityGrantAccount1).withdrawFunds();
          });

          it("THEN a FundsTransferred event should be emitted", async function () {
            return verifyFundsTransferredEmittedEvent(
              treasuryContract,
              communityGrantAccount1,
              communityGrant,
              values.COMM_GRANT_DONATION_VALUE,
            );
          });

          it(`THEN Contract Balance should be DECREASED by           ${values.COMM_GRANT_DONATION_VALUE}`, async function () {
            const difference = values.COMM_GRANT_DONATION_VALUE.mul(-1);
            return verifyBalance(txResult, signedTreasuryAddress, difference);
          });

          it(`THEN Community Grant account should receive            ${values.COMM_GRANT_DONATION_VALUE}`, async function () {
            return verifyBalance(txResult, signedCommunityGrantAccount1, values.COMM_GRANT_DONATION_VALUE);
          });

          it(`THEN Community Grant withdrawnFunds amount should be   ${values.COMM_GRANT_DONATION_VALUE}`, async function () {
            return verifyMemberWithdrawnFunds(treasuryContract, communityGrant, values.COMM_GRANT_DONATION_VALUE);
          });

          it(`THEN totalWithdrawnFunds should be                     ${values.COMM_GRANT_DONATION_VALUE}`, async function () {
            return verifyTotalWithdrawnFunds(treasuryContract, values.COMM_GRANT_DONATION_VALUE);
          });
        });

        describe(`WHEN a Client 1 account withdraws funds`, function () {
          const EXPECTED_TOTAL_WITHDRAWN_FUNDS = values.COMM_GRANT_DONATION_VALUE.add(values.VALUE_PER_CLIENT);

          before(async function () {
            txResult = await treasuryContract.connect(signedClient1Account1).withdrawFunds();
          });

          it("THEN a FundsTransferred event should be emitted", async function () {
            return verifyFundsTransferredEmittedEvent(
              treasuryContract,
              client1Account1,
              namedAccounts.client1,
              values.VALUE_PER_CLIENT,
            );
          });

          it(`THEN Contract Balance should be DECREASED by           ${values.VALUE_PER_CLIENT}`, async function () {
            const difference = values.VALUE_PER_CLIENT.mul(-1);
            return verifyBalance(txResult, signedTreasuryAddress, difference);
          });

          it(`THEN Client 1 account should receive                   ${values.VALUE_PER_CLIENT}`, async function () {
            return verifyBalance(txResult, signedClient1Account1, values.VALUE_PER_CLIENT);
          });

          it(`THEN Client 1 withdrawnFunds amount should be          ${values.VALUE_PER_CLIENT}`, async function () {
            return verifyMemberWithdrawnFunds(treasuryContract, namedAccounts.client1, values.VALUE_PER_CLIENT);
          });

          it(`THEN totalWithdrawnFunds should be                     ${EXPECTED_TOTAL_WITHDRAWN_FUNDS}`, async function () {
            return verifyTotalWithdrawnFunds(treasuryContract, EXPECTED_TOTAL_WITHDRAWN_FUNDS);
          });
        });

        describe("WHEN another Client 1 account tries to withdraw funds", function () {
          it("THEN the transaction should revert", async function () {
            await expect(treasuryContract.connect(signedClient1Account2).withdrawFunds()).to.be.revertedWith(
              "There are NO pending funds to withdraw for the caller-member",
            );
          });
        });

        describe(`WHEN receiving another a donation of               ${values.DONATED_VALUE}`, function () {
          before(async function () {
            txResult = await donator.sendTransaction({ to: treasuryContract.address, value: values.DONATED_VALUE });
          });

          it(`THEN the Contract Balance should be INCREASED by       ${values.DONATED_VALUE}`, async function () {
            return verifyBalance(txResult, signedTreasuryAddress, values.DONATED_VALUE);
          });

          describe("WHEN another Community Grant account withdraws funds", function () {
            const EXPECTED_COMM_GRANT_WITHDRAWN_FUNDS = values.COMM_GRANT_DONATION_VALUE.mul(2);
            const EXPECTED_TOTAL_WITHDRAWN_FUNDS = values.VALUE_PER_CLIENT.add(values.COMM_GRANT_DONATION_VALUE.mul(2));

            before(async function () {
              txResult = await treasuryContract.connect(signedCommunityGrantAccount2).withdrawFunds();
            });

            it("THEN a FundsTransferred event should be emitted", async function () {
              return verifyFundsTransferredEmittedEvent(
                treasuryContract,
                communityGrantAccount2,
                communityGrant,
                values.COMM_GRANT_DONATION_VALUE,
              );
            });

            it(`THEN Contract Balance should be DECREASED by         ${values.COMM_GRANT_DONATION_VALUE}`, async function () {
              const difference = values.COMM_GRANT_DONATION_VALUE.mul(-1);
              return verifyBalance(txResult, signedTreasuryAddress, difference);
            });

            it(`THEN Community Grant account should receive          ${values.COMM_GRANT_DONATION_VALUE}`, async function () {
              return verifyBalance(txResult, signedCommunityGrantAccount2, values.COMM_GRANT_DONATION_VALUE);
            });

            it(`THEN Community Grant withdrawnFunds amount should be ${EXPECTED_COMM_GRANT_WITHDRAWN_FUNDS}`, async function () {
              return verifyMemberWithdrawnFunds(treasuryContract, communityGrant, EXPECTED_COMM_GRANT_WITHDRAWN_FUNDS);
            });

            it(`THEN totalWithdrawnFunds should be                   ${EXPECTED_TOTAL_WITHDRAWN_FUNDS}`, async function () {
              return verifyTotalWithdrawnFunds(treasuryContract, EXPECTED_TOTAL_WITHDRAWN_FUNDS);
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
            const EXPECTED_CLIENT1_WITHDRAWN_FUNDS = values.VALUE_PER_CLIENT.mul(2);
            const EXPECTED_TOTAL_WITHDRAWN_FUNDS = values.COMM_GRANT_DONATION_VALUE.mul(2).add(
              EXPECTED_CLIENT1_WITHDRAWN_FUNDS,
            );

            before(async function () {
              txResult = await treasuryContract.connect(signedClient1Account2).withdrawFunds();
            });

            it("THEN a FundsTransferred event should be emitted", async function () {
              return verifyFundsTransferredEmittedEvent(
                treasuryContract,
                client1Account2,
                namedAccounts.client1,
                values.VALUE_PER_CLIENT,
              );
            });

            it(`THEN Contract Balance should be DECREASED by         ${values.VALUE_PER_CLIENT}`, async function () {
              const difference = values.VALUE_PER_CLIENT.mul(-1);
              return verifyBalance(txResult, signedTreasuryAddress, difference);
            });

            it(`THEN Client 1 account should receive                 ${values.VALUE_PER_CLIENT}`, async function () {
              return verifyBalance(txResult, signedClient1Account2, values.VALUE_PER_CLIENT);
            });

            it(`THEN Client 1 withdrawnFunds amount should be        ${EXPECTED_CLIENT1_WITHDRAWN_FUNDS}`, async function () {
              return verifyMemberWithdrawnFunds(
                treasuryContract,
                namedAccounts.client1,
                EXPECTED_CLIENT1_WITHDRAWN_FUNDS,
              );
            });

            it(`THEN totalWithdrawnFunds should be                   ${EXPECTED_TOTAL_WITHDRAWN_FUNDS}`, async function () {
              return verifyTotalWithdrawnFunds(treasuryContract, EXPECTED_TOTAL_WITHDRAWN_FUNDS);
            });
          });

          describe(`WHEN Client 2 account withdraws funds`, function () {
            const EXPECTED_CLIENT1_WITHDRAWN_FUNDS = values.VALUE_PER_CLIENT.mul(2);
            const EXPECTED_CLIENT2_WITHDRAWN_FUNDS = EXPECTED_CLIENT1_WITHDRAWN_FUNDS;
            const EXPECTED_TOTAL_WITHDRAWN_FUNDS = values.COMM_GRANT_DONATION_VALUE.mul(2)
              .add(EXPECTED_CLIENT1_WITHDRAWN_FUNDS)
              .add(EXPECTED_CLIENT2_WITHDRAWN_FUNDS);
            const FINAL_CONTRACT_BALANCE = values.DONATED_VALUE.mul(2).sub(EXPECTED_TOTAL_WITHDRAWN_FUNDS);

            before(async function () {
              txResult = await treasuryContract.connect(signedClient2Account1).withdrawFunds();
            });

            it("THEN a FundsTransferred event should be emitted", async function () {
              return verifyFundsTransferredEmittedEvent(
                treasuryContract,
                client2Account1,
                namedAccounts.client2,
                EXPECTED_CLIENT2_WITHDRAWN_FUNDS,
              );
            });

            it(`THEN Contract Balance should be DECREASED by         ${EXPECTED_CLIENT2_WITHDRAWN_FUNDS}`, async function () {
              const difference = EXPECTED_CLIENT2_WITHDRAWN_FUNDS.mul(-1);
              return verifyBalance(txResult, signedTreasuryAddress, difference);
            });

            it(`THEN Client 2 account should receive                 ${EXPECTED_CLIENT2_WITHDRAWN_FUNDS}`, async function () {
              return verifyBalance(txResult, signedClient2Account1, EXPECTED_CLIENT2_WITHDRAWN_FUNDS);
            });

            it(`THEN Client 2 withdrawnFunds amount should be        ${EXPECTED_CLIENT2_WITHDRAWN_FUNDS}`, async function () {
              return verifyMemberWithdrawnFunds(
                treasuryContract,
                namedAccounts.client2,
                EXPECTED_CLIENT2_WITHDRAWN_FUNDS,
              );
            });

            it(`THEN totalWithdrawnFunds should be                   ${EXPECTED_TOTAL_WITHDRAWN_FUNDS}`, async function () {
              return verifyTotalWithdrawnFunds(treasuryContract, EXPECTED_TOTAL_WITHDRAWN_FUNDS);
            });

            describe("WHEN another Client 2 account tries to withdraw funds", function () {
              it("THEN the transaction should revert", async function () {
                await expect(treasuryContract.connect(signedClient2Account2).withdrawFunds()).to.be.revertedWith(
                  "There are NO pending funds to withdraw for the caller-member",
                );
              });
            });

            describe(`WHEN querying the contract balance`, function () {
              it(`THEN it should return the actual balance           ${FINAL_CONTRACT_BALANCE}`, async function () {
                const contractBalance = BigNumber.from(await treasuryContract.getContractBalance());
                return expect(FINAL_CONTRACT_BALANCE).to.equal(contractBalance);
              });
            });
          });
        });
      });
    });
  });
});
