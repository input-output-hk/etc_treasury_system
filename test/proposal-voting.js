const { expectRevert, time } = require('@openzeppelin/test-helpers');
const { BN } = require('./helpers/helper.js');
const {
  proposalMinDeposit,
  proposalDebatingPeriod,
  lockedWaitingTime,
} = require('./helpers/constants.js');

const Treasury = artifacts.require('TestTreasury');

const votingStake = new BN(10);
let treasuryInstance;

contract(
  'Treasury: proposal voting',
  ([
    gitcoinAddress,
    newClient,
    proposalCreator,
    voterWithFundsAvailable,
    voterWithNoFundsAvailable,
  ]) => {
    describe('GIVEN no proposals', function () {
      before(async function () {
        treasuryInstance = await Treasury.new(gitcoinAddress, []);
      });

      describe('WHEN attempting voting for a proposal', function () {
        it('THEN it should fail', async function () {
          await expectRevert.assertion(
            treasuryInstance.vote(0, true, { from: voterWithFundsAvailable })
          );
        });
      });
    });

    describe('GIVEN a proposal for a new client', function () {
      const proposalID = 0;
      beforeEach(async function () {
        treasuryInstance = await Treasury.new(gitcoinAddress, []);

        await treasuryInstance.lockFunds({ value: votingStake, from: voterWithFundsAvailable });
        await time.increase(lockedWaitingTime);

        await treasuryInstance.proposeAddClient(newClient, {
          from: proposalCreator,
          value: proposalMinDeposit,
        });
      });

      describe('WHEN voting in favor', function () {
        beforeEach(async function () {
          await treasuryInstance.vote(proposalID, true, { from: voterWithFundsAvailable });
        });

        it('THEN it should reflected it on the status', async function () {
          const proposalState = await treasuryInstance.getProposalState.call(proposalID);
          const approvalVotes = votingStake.add(proposalMinDeposit);
          proposalState.approvalVotes.should.be.bignumber.equal(approvalVotes);
        });
      });

      describe('WHEN unvoting', function () {
        beforeEach(async function () {
          await treasuryInstance.vote(proposalID, true, { from: voterWithFundsAvailable });

          await treasuryInstance.unvote(proposalID, { from: voterWithFundsAvailable });
        });

        it('THEN it should reflected it on the status', async function () {
          const proposalState = await treasuryInstance.getProposalState.call(proposalID);
          proposalState.approvalVotes.should.be.bignumber.equal(proposalMinDeposit);
        });
      });

      describe('WHEN debating period has ended', function () {
        beforeEach(async function () {
          await time.increase(2 * proposalDebatingPeriod);
        });

        it('THEN voting should fail', async function () {
          await expectRevert(
            treasuryInstance.vote(proposalID, true, {
              from: voterWithFundsAvailable,
            }),
            'Debating period ended'
          );
        });

        it('THEN unvoting should fail', async function () {
          await expectRevert(
            treasuryInstance.unvote(proposalID, {
              from: voterWithFundsAvailable,
            }),
            'Debating period ended'
          );
        });
      });

      describe('WHEN not enough funds are locked', function () {
        it('THEN voting should fail', async function () {
          await treasuryInstance.lockFunds({ value: votingStake, from: voterWithNoFundsAvailable });

          await expectRevert(
            treasuryInstance.vote(proposalID, true, {
              from: voterWithNoFundsAvailable,
            }),
            'No unlocked funds available for usage'
          );
        });
      });
    });
  }
);
