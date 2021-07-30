/// @note These tests are tied together and conform whitelisting user cases.
/// @note Removing one describe can break the flow.
/// @note The main purpose of this file is to show the whitelisting functionality.

import { waffle, ethers, getNamedAccounts } from "hardhat";
import { fixtureDeployScript } from "./helpers/common-fixtures";
import { expect } from "chai";
import { Treasury } from "../typechain";
import { Signer } from "ethers";
import { ContractTransaction } from "@ethersproject/contracts";
import { ZERO_ADDRESS } from "./helpers/constants";
const { loadFixture } = waffle;

describe("Feature: Treasury whitelisting", () => {
  let namedAccounts: { [name: string]: string };
  let client1: string;
  let signedClient1: Signer;
  let signedClient2: Signer;
  let client1Account1: string;
  let signedOtherAccount: Signer;
  let txResult: ContractTransaction;

  before(async function () {
    namedAccounts = await getNamedAccounts();
    client1 = namedAccounts.client1;
    client1Account1 = namedAccounts.client1Account1;
    signedOtherAccount = await ethers.getSigner(namedAccounts.otherAccount1);
    signedClient1 = await ethers.getSigner(namedAccounts.client1);
    signedClient2 = await ethers.getSigner(namedAccounts.client2);
  });

  describe("GIVEN a contract with three clients and 10% Community Reward", function () {
    let treasuryContract: Treasury;
    before(async function () {
      // This fixture executes the deployment script with the default values (../deploy/deploy.ts)
      // Three Clients and a Community Grant reward of 10%
      treasuryContract = await loadFixture(fixtureDeployScript);
    });

    describe("WHEN whitelisting is performed by non member", function () {
      it("THEN the transaction should revert", async function () {
        await expect(treasuryContract.connect(signedOtherAccount).addToWhitelist(client1Account1)).to.be.revertedWith(
          "Sender it's not a valid member of Treasury",
        );
      });
    });

    describe("WHEN whitelisting is performed by a member", function () {
      before(async function () {
        txResult = await treasuryContract.connect(signedClient1).addToWhitelist(client1Account1);
      });

      it("THEN the address should be whitelisted and belonging to the calling member", async function () {
        const inContractAddressClient1 = await treasuryContract.authorizedAddresses(client1Account1);
        expect(inContractAddressClient1.toString()).to.equal(client1);
      });

      it("THEN a Whitelisted Event should be emmited", async function () {
        await expect(txResult).to.emit(treasuryContract, "AddedToWhitelist").withArgs(client1, client1Account1);
      });
    });

    describe("WHEN whitelisting an already whitelisted address by a member", function () {
      it("THEN the transaction should revert", async function () {
        await expect(treasuryContract.connect(signedClient1).addToWhitelist(client1Account1)).to.be.revertedWith(
          "Address is already whitelisted",
        );
      });
    });

    describe("WHEN removing from whitelist is performed by non member", function () {
      it("THEN the transaction should revert", async function () {
        await expect(
          treasuryContract.connect(signedOtherAccount).removeFromWhitelist(client1Account1),
        ).to.be.revertedWith("Sender it's not a valid member of Treasury");
      });
    });

    describe("WHEN a member tries to remove another member address from the whitelist", function () {
      it("THEN the transaction should revert", async function () {
        await expect(treasuryContract.connect(signedClient2).removeFromWhitelist(client1Account1)).to.be.revertedWith(
          "Caller does not own the address to be removed",
        );
      });
    });

    describe("WHEN remove from whitelist is performed by a member", function () {
      before(async function () {
        txResult = await treasuryContract.connect(signedClient1).removeFromWhitelist(client1Account1);
      });

      it("THEN the address should be removed from whitelist", async function () {
        const inContractAddressClient1 = await treasuryContract.authorizedAddresses(client1Account1);
        expect(inContractAddressClient1.toString()).to.equal(ZERO_ADDRESS);
      });

      it("THEN a RemovedFromWhitelist Event should be emmited", async function () {
        await expect(txResult).to.emit(treasuryContract, "RemovedFromWhitelist").withArgs(client1, client1Account1);
      });
    });

    describe("WHEN removing an already removed address by a member", function () {
      it("THEN the transaction should revert", async function () {
        await expect(treasuryContract.connect(signedClient1).removeFromWhitelist(client1Account1)).to.be.revertedWith(
          "Address is not whitelisted",
        );
      });
    });
  });
});
