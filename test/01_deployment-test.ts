/// @note The main purpose of this file is to show how the deployment works.
/// @note These tests use deploy.ts script by loading a fixture in the
/// @note heplers/common-fixtures.ts file.

import { ethers, waffle, getNamedAccounts } from "hardhat";
import { invalidDeployment } from "./helpers/shared-functions";
import { fixtureDeployScript } from "./helpers/common-fixtures";
import { ONE_BASE18, ONE_HUNDRED_BASE18, ZERO } from "./helpers/constants";
import { expect } from "chai";
import { Treasury } from "../typechain";
import { Signer, BigNumber } from "ethers";
const { loadFixture } = waffle;

const QTY_CLIENTS = 3;
const REWARD_PERCENT = 10;
const COMMGRANT_PERCENT_B18 = BigNumber.from(REWARD_PERCENT).mul(ONE_BASE18);
const ZERO_DONATED_VALUE = BigNumber.from(0);

describe("Feature: Treasury deployment - structure - percentages", () => {
  let namedAccounts: { [name: string]: string };
  let client1: string;
  let client2: string;
  let client3: string;
  let client4: string;
  let communityGrant: string;
  let donator: Signer;

  before(async function () {
    namedAccounts = await getNamedAccounts();
    client1 = namedAccounts.client1;
    client2 = namedAccounts.client2;
    client3 = namedAccounts.client3;
    client4 = namedAccounts.client4;
    communityGrant = namedAccounts.communityGrant;
    donator = await ethers.getSigner(namedAccounts.donator);
  });

  describe("GIVEN a contract with no clients", function () {
    describe("WHEN trying to deploy", function () {
      it("THEN transaction should fail", async function () {
        await expect(invalidDeployment(COMMGRANT_PERCENT_B18, false, false, false, false)).to.be.revertedWith(
          "Deployed clients should be greater than One",
        );
      });
    });
  });

  describe("GIVEN a contract with an Invalid Community Grant address", function () {
    describe("WHEN trying to deploy", function () {
      it("THEN transaction should fail", async function () {
        await expect(invalidDeployment(COMMGRANT_PERCENT_B18, true, false, false, true)).to.be.reverted;
      });
    });
  });

  describe("GIVEN a contract with an Invalid address in the Client Array", function () {
    describe("WHEN trying to deploy", function () {
      it("THEN transaction should fail", async function () {
        await expect(invalidDeployment(COMMGRANT_PERCENT_B18, false, true, false, true)).to.be.reverted;
      });
    });
  });

  describe("GIVEN a contract with Invalid Community Grant percentage (0%)", function () {
    describe("WHEN trying to deploy", function () {
      it("THEN transaction should fail", async function () {
        await expect(invalidDeployment(BigNumber.from(0), false, false, false, true)).to.be.revertedWith(
          "Invalid Community Grant percentage. Must be greater than ZERO",
        );
      });
    });
  });

  describe("GIVEN a contract with Invalid Community Grant percentage (101%)", function () {
    describe("WHEN trying to deploy", function () {
      it("THEN transaction should fail", async function () {
        const moreThanOneHundred = ONE_HUNDRED_BASE18.add(1);
        await expect(invalidDeployment(moreThanOneHundred, false, false, false, true)).to.be.revertedWith(
          "Invalid Community Grant percentage. Must be lower than 100%",
        );
      });
    });
  });

  describe("GIVEN a contract with duplicated client addresses", function () {
    describe("WHEN trying to deploy", function () {
      it("THEN transaction should fail", async function () {
        await expect(invalidDeployment(COMMGRANT_PERCENT_B18, false, false, true, true)).to.be.revertedWith(
          "Duplicated Client address found",
        );
      });
    });
  });

  describe("GIVEN a contract with three clients and 10% Community Reward (DEPLOY SCRIPT TEST)", function () {
    let treasuryContract: Treasury;
    before(async function () {
      // This fixture executes the deployment script with the default values (../deploy/deploy.ts)
      // Three Clients and a Community Grant reward of 10%
      treasuryContract = await loadFixture(fixtureDeployScript);
    });

    describe("WHEN quering for the data structure created", function () {
      const CG_EXPECTED_PERCENT = COMMGRANT_PERCENT_B18.div(ONE_BASE18);
      const EACH_CLIENT_EXPECTED_PERCENT_B18 = ONE_HUNDRED_BASE18.sub(COMMGRANT_PERCENT_B18).div(QTY_CLIENTS);
      const EACH_CLIENT_EXPECTED_PERCENT = EACH_CLIENT_EXPECTED_PERCENT_B18.div(ONE_BASE18);

      it("THEN Community Grant must be defined", async function () {
        const communityGrant_ = await treasuryContract.members(communityGrant);
        expect(communityGrant_.name).to.equal("CommunityGrant");
      });
      it(`THEN Community Grant percentage must be ${CG_EXPECTED_PERCENT}%`, async function () {
        const communityGrant_ = await treasuryContract.members(communityGrant);
        expect(communityGrant_.percentage).to.equal(COMMGRANT_PERCENT_B18);
      });

      it("THEN Clients mapping should be filled", async function () {
        const client1_ = await treasuryContract.members(client1);
        expect(client1_.name).to.equal("client1");

        const client2_ = await treasuryContract.members(client2);
        expect(client2_.name).to.equal("client2");

        const client3_ = await treasuryContract.members(client3);
        expect(client3_.name).to.equal("client3");
      });

      it(`THEN Clients percentage must be ${EACH_CLIENT_EXPECTED_PERCENT}% Each`, async function () {
        const client1_ = await treasuryContract.members(client1);
        expect(client1_.percentage).to.equal(EACH_CLIENT_EXPECTED_PERCENT_B18);

        const client2_ = await treasuryContract.members(client2);
        expect(client2_.percentage).to.equal(EACH_CLIENT_EXPECTED_PERCENT_B18);

        const client3_ = await treasuryContract.members(client3);
        expect(client3_.percentage).to.equal(EACH_CLIENT_EXPECTED_PERCENT_B18);
      });

      it("THEN Client 4 name should be empty", async function () {
        const client4_ = await treasuryContract.members(client4);
        expect(client4_.name).to.equal("");
      });

      it("THEN Client 4 percentage should be ZERO", async function () {
        const client4_ = await treasuryContract.members(client4);
        expect(client4_.percentage).to.equal(ZERO);
      });

      describe(`WHEN sending ZERO ethers to the contract`, function () {
        it("THEN a transaction should fail", async function () {
          await expect(
            donator.sendTransaction({ to: treasuryContract.address, value: ZERO_DONATED_VALUE }),
          ).to.be.revertedWith("Cannot receive 0 Ethers");
        });
      });
    });
  });
});
