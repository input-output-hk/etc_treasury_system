/// @note These tests are tied together and coform various user cases.
/// @note Removing one describe can break the flow.
/// @note The main purpose of this file is to show how the contract can
/// @note work the same way by being deployed/called by different sources.
/// @note In these tests the Treasury is deployed with:
/// @note Community Grant member as a multisig
/// @note Client1 as a member with an asociadted multisig withdrawer
/// @note Client1 as a member with a regular wallet

import { Treasury, GnosisSafeTest, GnosisSafeProxyFactoryTest } from "../typechain";
import { waffle, ethers, getNamedAccounts } from "hardhat";
import { Signer, ContractTransaction, Event } from "ethers";
import { ONE_HUNDRED_BASE18, ZERO, ZERO_ADDRESS } from "./helpers/constants";
import EthersSafe, { ContractNetworksConfig } from "@gnosis.pm/safe-core-sdk";
import { SafeTransaction, SafeTransactionDataPartial } from "@gnosis.pm/safe-core-sdk-types";
import { BigNumber } from "@ethersproject/bignumber";
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

describe("Feature: Treasury Withdraw Funds calculations with Gnosis Safe", () => {
  let namedAccounts: { [name: string]: string };
  let donator: Signer;

  let ownersMsigCommGrant: string[];
  let ownersMsigClient1: string[];
  let proxyFactory: GnosisSafeProxyFactoryTest;
  let gnosisSafeMasterCopy: GnosisSafeTest;
  let multisigCommGrant: GnosisSafeTest;
  let multisigClient1: GnosisSafeTest;

  let safeCommGrantSigner1: EthersSafe;

  let safeClient1Signer1: EthersSafe;

  let contractNetworks: ContractNetworksConfig;

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

  /// @note Deploy the Proxy to spawn the Gnosis Safe
  async function deployGnosisProxy() {
    const factoryProxy = await ethers.getContractFactory("GnosisSafeProxyFactoryTest");
    const proxyFactory_ = (await factoryProxy.deploy()) as GnosisSafeProxyFactoryTest;
    await proxyFactory_.deployTransaction.wait();
    return proxyFactory_ as GnosisSafeProxyFactoryTest;
  }

  /// @note Deploy the master copy of the Gnosis Safe
  async function deployGnosisMasterContract() {
    const factorySafe = await ethers.getContractFactory("GnosisSafeTest");
    const gnosisSafeMasterCopy_ = (await factorySafe.deploy()) as GnosisSafeTest;
    await gnosisSafeMasterCopy_.deployTransaction.wait();
    return gnosisSafeMasterCopy_ as GnosisSafeTest;
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
    gnosisSafeMasterCopy_: GnosisSafeTest,
    proxyFactory_: GnosisSafeProxyFactoryTest,
  ) {
    const gnosisSafeData = gnosisSafeMasterCopy_.interface.encodeFunctionData("setup", [
      multisigOwners,
      qtyToExecute,
      ZERO_ADDRESS,
      "0x",
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      0,
      ZERO_ADDRESS,
    ]);
    const tx = await proxyFactory_.createProxy(gnosisSafeMasterCopy_.address, gnosisSafeData);
    const txReceipt = await tx.wait();

    let contractAddress;
    let events: Event[];
    if (txReceipt && txReceipt.events) {
      events = txReceipt.events.filter(obj => obj.event === "ProxyCreation" && obj.address === proxyFactory_.address);
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

  /// @note Approve multisig transaction (On Chain)
  async function approveTransaction(
    createdSafe: EthersSafe,
    signerToConnect: Signer,
    safeAddress_: string,
    contractNetworks_: ContractNetworksConfig,
    safeTransaction: SafeTransaction,
    multisigContractAddress: string,
  ) {
    /// @note On chain approval
    contractNetworks_ = await setContractNetworks(multisigContractAddress);
    const safeInstance = await createdSafe.connect({
      providerOrSigner: signerToConnect,
      safeAddress: safeAddress_,
      contractNetworks: contractNetworks_,
    });
    const txHash = await safeInstance.getTransactionHash(safeTransaction);
    const approveTxResponse = await safeInstance.approveTransactionHash(txHash);
    await approveTxResponse.wait();
  }

  /// @note Execute multisig transaction
  async function executeTransaction(
    createdSafe: EthersSafe,
    signerToConnect: Signer,
    safeAddress_: string,
    contractNetworks_: ContractNetworksConfig,
    safeTransaction: SafeTransaction,
  ) {
    const safeInstance = await createdSafe.connect({
      providerOrSigner: signerToConnect,
      safeAddress: safeAddress_,
      contractNetworks: contractNetworks_,
    });

    /// @note Execute transaction (implicit approval)
    const executeTxResponse = await safeInstance.executeTransaction(safeTransaction);
    await executeTxResponse.wait();
    txResult = executeTxResponse;
  }

  before(async function () {
    /// @note Get all the signers
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

    proxyFactory = await deployGnosisProxy();
    gnosisSafeMasterCopy = await deployGnosisMasterContract();

    /// @note deploy a multisig for community grant with a thershold of 3 to execute a transaction
    ownersMsigCommGrant = [
      namedAccounts.communityGrant,
      namedAccounts.communityGrantAccount1,
      namedAccounts.communityGrantAccount2,
    ];
    multisigCommGrant = await deployGnosisSafe(ownersMsigCommGrant, 3, gnosisSafeMasterCopy, proxyFactory);
    contractNetworks = await setContractNetworks(multisigCommGrant.address);
    safeCommGrantSigner1 = await EthersSafe.create({
      ethers,
      safeAddress: multisigCommGrant.address,
      providerOrSigner: signedCommunityGrant,
      contractNetworks,
    });

    /// @note deploy a multisig for client1 with a thershold of 2 to execute a transaction
    ownersMsigClient1 = [namedAccounts.client1Account1, namedAccounts.client1Account2];
    multisigClient1 = await deployGnosisSafe(ownersMsigClient1, 2, gnosisSafeMasterCopy, proxyFactory);
    contractNetworks = await setContractNetworks(multisigClient1.address);
    safeClient1Signer1 = await EthersSafe.create({
      ethers,
      safeAddress: multisigClient1.address,
      providerOrSigner: signedClient1Account1,
      contractNetworks,
    });
  });

  describe("GIVEN a contract with 2 clients and 10% Community Reward", function () {
    /// @note Set contract variables for constructor
    const REWARD_PERCENT = 10;
    const CLIENTS_QTY = 2;
    const DONATED_VALUE = ONE_HUNDRED_BASE18;

    let treasuryContract: Treasury;
    let signedTreasuryAddress: Signer;

    let transactions: SafeTransactionDataPartial[];
    let safeTransaction: SafeTransaction;

    let safeCommGrantAddress: string;
    let safeClient1Address: string;

    before(async function () {
      /// @note Get safe addresses
      safeCommGrantAddress = safeCommGrantSigner1.getAddress();
      safeClient1Address = safeClient1Signer1.getAddress();

      /// @note replace hardhat community grant address with the gnosis safe address to be one of the members
      members = buildMembersData(REWARD_PERCENT, CLIENTS_QTY, namedAccounts);
      members[0].address = safeCommGrantAddress;

      /// @note Deploy Treasury contract with
      /// @note Community Grant member as a multisig
      /// @note Client1 as a member with an asociadted multisig withdrawer
      /// @note Client1 as a member with a regular wallet
      treasuryContract = await customDeployTreasuryContract(members);
    });

    /// @note Tests to show the proper configuration of the created Gnosis Safes
    describe("GIVEN the created Gnosis Safes", function () {
      it(`THEN the Community Grant safe should contain 3 owners`, async function () {
        const ownersCg = await safeCommGrantSigner1.getOwners();
        const arrayEquals1 = JSON.stringify(ownersMsigCommGrant) === JSON.stringify(ownersCg);
        expect(arrayEquals1).to.be.true;
      });

      it(`THEN the Client1 safe should contain 2 owners`, async function () {
        const ownersClient1 = await safeClient1Signer1.getOwners();
        const arrayEquals1 = JSON.stringify(ownersMsigClient1) === JSON.stringify(ownersClient1);
        expect(arrayEquals1).to.be.true;
      });

      it("THEN Signers of each Safe should correspond to each account", async function () {
        expect(safeCommGrantSigner1.getSigner()).to.be.eq(signedCommunityGrant);
        expect(safeClient1Signer1.getSigner()).to.be.eq(signedClient1Account1);
      });
    });

    describe("GIVEN the whitdrawers are whitelisted", function () {
      before(async function () {
        /// @note white listing the safe address to withdraw funds
        /// @note signedCommunityGrant authorizing its safeAddress
        const whitelistData = treasuryContract.interface.encodeFunctionData("addToWhitelist", [safeCommGrantAddress]);
        transactions = [
          {
            to: treasuryContract.address,
            value: "0",
            data: whitelistData,
          },
        ];
        safeTransaction = await safeCommGrantSigner1.createTransaction(...transactions);

        /// @note Off chain signature
        await safeCommGrantSigner1.signTransaction(safeTransaction);

        /// @note Call to On chain approval
        await approveTransaction(
          safeCommGrantSigner1,
          signedCommunityGrantAccount1,
          safeCommGrantAddress,
          contractNetworks,
          safeTransaction,
          multisigCommGrant.address,
        );

        /// @note Call to Execute Transaction
        await executeTransaction(
          safeCommGrantSigner1,
          signedCommunityGrantAccount2,
          safeCommGrantAddress,
          contractNetworks,
          safeTransaction,
        );

        /// @note Client1 authorizing its safeAddress
        await treasuryContract.connect(signedClient1).addToWhitelist(safeClient1Address);

        /// @note Client2 authorizing its both accounts
        await treasuryContract.connect(signedClient2).addToWhitelist(namedAccounts.client2Account1);
        await treasuryContract.connect(signedClient2).addToWhitelist(namedAccounts.client2Account2);

        signedTreasuryAddress = await ethers.getSigner(treasuryContract.address);
      });

      it(`THEN the Contract Balance should be ZERO`, async function () {
        const contractBalance = await treasuryContract.getContractBalance();
        expect(contractBalance).to.equal(ZERO);
      });

      it(`THEN both Safe Balances should be ZERO`, async function () {
        const safeCgBalance = await safeCommGrantSigner1.getBalance();
        expect(safeCgBalance).to.equal(ZERO);

        const safeClient1Balance = await safeClient1Signer1.getBalance();
        expect(safeClient1Balance).to.equal(ZERO);
      });

      describe(`WHEN receiving a donation of ${DONATED_VALUE}`, function () {
        before(async function () {
          txResult = await donator.sendTransaction({ to: treasuryContract.address, value: DONATED_VALUE });
          globalValues.totalFundsReceived = globalValues.totalFundsReceived.add(DONATED_VALUE);
        });

        it(`THEN the Contract Balance should be ${DONATED_VALUE}`, async function () {
          return verifyBalance(txResult, signedTreasuryAddress, DONATED_VALUE);
        });

        describe("WHEN a Community Grant account withdraws funds", function () {
          before(async function () {
            const withdrawData = treasuryContract.interface.encodeFunctionData("withdrawFunds");

            transactions = [
              {
                to: treasuryContract.address,
                value: "0",
                data: withdrawData,
              },
            ];
            safeTransaction = await safeCommGrantSigner1.createTransaction(...transactions);

            /// @note Off chain signature
            await safeCommGrantSigner1.signTransaction(safeTransaction);

            /// @note Call to On chain approval
            await approveTransaction(
              safeCommGrantSigner1,
              signedCommunityGrantAccount1,
              safeCommGrantAddress,
              contractNetworks,
              safeTransaction,
              multisigCommGrant.address,
            );

            /// @note Call to Execute Transaction
            await executeTransaction(
              safeCommGrantSigner1,
              signedCommunityGrantAccount2,
              safeCommGrantAddress,
              contractNetworks,
              safeTransaction,
            );

            withDrawUpdatesOperations("CommunityGrant", members, globalValues, memberValues);
          });

          it("THEN a FundsTransferred event should be emitted", async function () {
            return verifyFundsTransferredEmittedEvent(
              treasuryContract,
              safeCommGrantAddress,
              safeCommGrantAddress,
              memberValues.amountToWithdraw,
              txResult,
            );
          });

          it(`THEN Contract Balance should be DECREASED by the withdraw amount`, async function () {
            const difference = memberValues.amountToWithdraw.mul(-1);
            return verifyBalance(txResult, signedTreasuryAddress, difference);
          });

          it(`THEN Community Grant Multisig account should receive the ${REWARD_PERCENT}% of ${DONATED_VALUE}`, async function () {
            const sdkCgBalance = await safeCommGrantSigner1.getBalance();
            expect(sdkCgBalance).to.equal(memberValues.amountToWithdraw);
          });

          it(`THEN Community Grant withdrawnFunds amount should be INCREASED by the withdraw amount`, async function () {
            return verifyMemberWithdrawnFunds(
              treasuryContract,
              safeCommGrantAddress,
              memberValues.memberWithdrawnFunds,
            );
          });

          it(`THEN totalWithdrawnFunds should be INCREASED by the withdraw amount`, async function () {
            return verifyTotalWithdrawnFunds(treasuryContract, globalValues.totalWithdrawnAmounts);
          });
        });

        describe(`WHEN a Client 1 account withdraws funds`, function () {
          before(async function () {
            transactions = [
              {
                to: treasuryContract.address,
                value: "0",
                data: treasuryContract.interface.encodeFunctionData("withdrawFunds"),
              },
            ];
            safeTransaction = await safeClient1Signer1.createTransaction(...transactions);

            /// @note Off chain signature
            await safeClient1Signer1.signTransaction(safeTransaction);

            /// @note Call to Execute Transaction
            contractNetworks = await setContractNetworks(multisigClient1.address);
            await executeTransaction(
              safeClient1Signer1,
              signedClient1Account2,
              safeClient1Address,
              contractNetworks,
              safeTransaction,
            );

            withDrawUpdatesOperations("client1", members, globalValues, memberValues);
          });

          it("THEN a FundsTransferred event should be emitted", async function () {
            return verifyFundsTransferredEmittedEvent(
              treasuryContract,
              safeClient1Address,
              namedAccounts.client1,
              memberValues.amountToWithdraw,
              txResult,
            );
          });

          it(`THEN Contract Balance should be DECREASED by the withdraw amount`, async function () {
            const difference = memberValues.amountToWithdraw.mul(-1);
            return verifyBalance(txResult, signedTreasuryAddress, difference);
          });

          it(`THEN Client 1 Multisig account should receive the withdrawn amount`, async function () {
            const sdkCl1Balance = await safeClient1Signer1.getBalance();
            expect(sdkCl1Balance).to.equal(memberValues.amountToWithdraw);
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

        describe(`WHEN receiving another a donation of ${DONATED_VALUE}`, function () {
          before(async function () {
            txResult = await donator.sendTransaction({ to: treasuryContract.address, value: DONATED_VALUE });
            globalValues.totalFundsReceived = globalValues.totalFundsReceived.add(DONATED_VALUE);
          });

          it(`THEN the Contract Balance should be INCREASED by ${DONATED_VALUE}`, async function () {
            return verifyBalance(txResult, signedTreasuryAddress, DONATED_VALUE);
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
