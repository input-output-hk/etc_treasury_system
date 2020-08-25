const { time, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { getBalanceBN } = require('./helpers/helper.js');
const {
  proposalMinDeposit,
  proposalDebatingPeriod,
  lockedWaitingTime,
  proposalMinQuorum,
} = require('./helpers/constants.js');

const Treasury = artifacts.require('TestTreasury');

const votingStake = proposalMinQuorum;
let treasuryInstance;

contract(
  'Treasury: proposal ending',
  ([gitcoinAddress, newClient, proposalCreator, voterWithFundsAvailable]) => {
    describe('GIVEN a pre-approved proposal', function () {
      const proposalID = 0;
      let proposalCreatorBalanceBeforeProposal;
      beforeEach(async function () {
        treasuryInstance = await Treasury.new(gitcoinAddress, []);

        // Lock funds for voting
        await treasuryInstance.lockFunds({ value: votingStake, from: voterWithFundsAvailable });
        await time.increase(lockedWaitingTime);

        proposalCreatorBalanceBeforeProposal = await getBalanceBN(proposalCreator);

        // Create proposal
        await treasuryInstance.proposeAddClient(newClient, {
          from: proposalCreator,
          value: proposalMinDeposit,
          gasPrice: 0,
        });

        // Reach quorum
        await treasuryInstance.vote(proposalID, true, { from: voterWithFundsAvailable });

        // Pre-approve proposal
        await treasuryInstance.preApprove(proposalID);
      });

      describe('WHEN executing it after debating period is over', function () {
        beforeEach(async function () {
          await time.increase(proposalDebatingPeriod + 1);

          await treasuryInstance.execProposal(proposalID, 0);
        });

        it('THEN the creator can recover his deposit', async function () {
          await treasuryInstance.recoverProposalDeposit(proposalID);
          const proposalCreatorBalanceAfterProposal = await getBalanceBN(proposalCreator);
          proposalCreatorBalanceAfterProposal.should.be.bignumber.equal(
            proposalCreatorBalanceBeforeProposal
          );
        });
      });

      describe('WHEN proposal was already executed', function () {
        beforeEach(async function () {
          // First successful execution
          await time.increase(proposalDebatingPeriod + 1);
          await treasuryInstance.execProposal(proposalID, 0);
        });

        it('THEN execution should fail', async function () {
          await expectRevert(
            treasuryInstance.execProposal(proposalID, 0),
            'Ending a non active proposal'
          );
        });

        it('THEN closing should fail', async function () {
          await expectRevert(
            treasuryInstance.closeProposal(proposalID),
            'Ending a non active proposal'
          );
        });
      });

      describe('WHEN proposal was already closed', function () {
        beforeEach(async function () {
          await treasuryInstance.unvote(proposalID, { from: voterWithFundsAvailable });
          await time.increase(proposalDebatingPeriod + 1);
          await treasuryInstance.closeProposal(proposalID);
        });

        it('THEN execution should fail', async function () {
          await expectRevert(
            treasuryInstance.execProposal(proposalID, 0),
            'Ending a non active proposal'
          );
        });

        it('THEN closing should fail', async function () {
          await expectRevert(
            treasuryInstance.closeProposal(proposalID),
            'Ending a non active proposal'
          );
        });
      });

      describe('WHEN there is quorum and debating period is over', function () {
        beforeEach(async function () {
          // Remove quorum
          await treasuryInstance.unvote(proposalID, { from: voterWithFundsAvailable });

          await time.increase(proposalDebatingPeriod + 1);
        });

        it('THEN execution should fail', async function () {
          await expectRevert(
            treasuryInstance.execProposal(proposalID, 0),
            'Not enough quorum for execution'
          );
        });

        it('THEN closing should be successful', async function () {
          const closeProposalResult = await treasuryInstance.closeProposal(proposalID);

          await expectEvent(closeProposalResult, 'ClosedProposal', {
            _proposalID: proposalID.toString(),
          });
        });
      });

      describe('WHEN executing it while debating period is in progress', function () {
        it('THEN execution should fail', async function () {
          await expectRevert(
            treasuryInstance.execProposal(proposalID, 0),
            'Debating period in progress'
          );
        });

        it('THEN closing should fail', async function () {
          await expectRevert(
            treasuryInstance.closeProposal(proposalID),
            'Debating period in progress'
          );
        });
      });
    });

    describe('GIVEN a non pre-approved proposal', function () {
      const proposalID = 0;
      beforeEach(async function () {
        treasuryInstance = await Treasury.new(gitcoinAddress, []);

        // Lock funds for voting
        await treasuryInstance.lockFunds({ value: votingStake, from: voterWithFundsAvailable });
        await time.increase(lockedWaitingTime);

        // Create proposal
        await treasuryInstance.proposeAddClient(newClient, {
          from: proposalCreator,
          value: proposalMinDeposit,
          gasPrice: 0,
        });

        // Reach quorum
        await treasuryInstance.vote(proposalID, true, { from: voterWithFundsAvailable });
      });

      describe('WHEN executing it after voting period is over', function () {
        beforeEach(async function () {
          await time.increase(proposalDebatingPeriod + 1);
        });

        it('THEN execution should fail', async function () {
          await expectRevert(
            treasuryInstance.execProposal(proposalID, 0),
            'Proposal should be pre-approved'
          );
        });

        it('THEN closing should be successful', async function () {
          const closeProposalResult = await treasuryInstance.closeProposal(proposalID);

          await expectEvent(closeProposalResult, 'ClosedProposal', {
            _proposalID: proposalID.toString(),
          });
        });
      });
    });
  }
);
