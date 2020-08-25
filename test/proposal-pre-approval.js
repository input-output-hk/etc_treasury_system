const { time, expectRevert } = require('@openzeppelin/test-helpers');
const {
  proposalMinDeposit,
  proposalDebatingPeriod,
  lockedWaitingTime,
  proposalMinQuorum,
  proposalPreSupportPeriod,
} = require('./helpers/constants.js');

const Treasury = artifacts.require('TestTreasury');

const votingStake = proposalMinQuorum;
let treasuryInstance;

contract(
  'Treasury: proposal pre-approval',
  ([gitcoinAddress, newClient, proposalCreator, voterWithFundsAvailable]) => {
    describe('GIVEN a proposal for a new client', function () {
      const proposalID = 0;
      beforeEach(async function () {
        treasuryInstance = await Treasury.new(gitcoinAddress, []);

        // Lock funds for voting
        await treasuryInstance.lockFunds({ value: votingStake, from: voterWithFundsAvailable });
        await time.increase(lockedWaitingTime);

        await treasuryInstance.proposeAddClient(newClient, {
          from: proposalCreator,
          value: proposalMinDeposit,
          gasPrice: 0,
        });
      });

      describe('WHEN pre-approving it after reaching quorum', function () {
        beforeEach(async function () {
          await treasuryInstance.vote(proposalID, true, { from: voterWithFundsAvailable });

          await treasuryInstance.preApprove(proposalID);
        });

        it('THEN the proposal should have pre-support', async function () {
          const proposalState = await treasuryInstance.getProposalState.call(proposalID);
          assert(proposalState.preSupport, 'Proposal does not have pre-support');
        });
      });

      describe('WHEN pre-approving it for a second time', function () {
        beforeEach(async function () {
          await treasuryInstance.vote(proposalID, true, { from: voterWithFundsAvailable });

          await treasuryInstance.preApprove(proposalID);
        });

        it('THEN the second pre-approval should fail', async function () {
          await expectRevert(treasuryInstance.preApprove(proposalID), 'Already pre-approved');
        });
      });

      describe('WHEN pre-approving it without quorum', function () {
        it('THEN execution should fail', async function () {
          await expectRevert(
            treasuryInstance.preApprove(proposalID),
            'Not enough quorum for pre-approval'
          );
        });
      });

      describe('WHEN pre-approving it after preSupport period is over', function () {
        beforeEach(async function () {
          await treasuryInstance.vote(proposalID, true, { from: voterWithFundsAvailable });

          await time.increase(proposalDebatingPeriod - proposalPreSupportPeriod + 1);
        });

        it('THEN pre-approval should fail', async function () {
          await expectRevert(
            treasuryInstance.preApprove(proposalID),
            'Pre-approve deadline already reached'
          );
        });
      });
    });
  }
);
