const { time, expectRevert } = require('@openzeppelin/test-helpers');
const {
  proposalMinDeposit,
  proposalDebatingPeriod,
  lockedWaitingTime,
  proposalMinQuorum,
  shutdownGracePeriod,
} = require('./helpers/constants.js');
const { BN, getBalanceBN } = require('./helpers/helper.js');

const Treasury = artifacts.require('TestTreasury');

const votingStake = new BN(proposalMinQuorum);
const clientIndex = new BN(0);
let treasuryInstance;

contract(
  'Treasury: shutdown',
  ([gitcoinAddress, proposalCreator, otherAddress, voter1, voter2]) => {
    describe('GIVEN a scheduled shutdown with no proposals', function () {
      const proposalID = 0;
      beforeEach(async function () {
        treasuryInstance = await Treasury.new(gitcoinAddress, []);

        // Lock funds for voting
        await treasuryInstance.lockFunds({ value: votingStake, from: voter1 });
        await time.increase(lockedWaitingTime);

        // Create proposal
        await treasuryInstance.proposeShutdown({
          from: proposalCreator,
          value: proposalMinDeposit,
          gasPrice: 0,
        });

        // Reach quorum
        await treasuryInstance.vote(proposalID, true, { from: voter1 });

        // Pre-approve proposal
        await treasuryInstance.preApprove(proposalID);

        // Finish the debating period
        await time.increase(proposalDebatingPeriod + 1);

        // Execute proposal
        await treasuryInstance.execProposal(proposalID, clientIndex);
      });

      describe('WHEN creating a proposal', function () {
        it('THEN it should fail', async function () {
          await expectRevert(
            treasuryInstance.proposeAddClient(otherAddress),
            'Shutdown in progress'
          );
        });
      });

      describe('WHEN locking funds', function () {
        it('THEN it should fail', async function () {
          await expectRevert(
            treasuryInstance.lockFunds({ from: otherAddress }),
            'Shutdown in progress'
          );
        });
      });

      describe('WHEN grace period is over', function () {
        beforeEach(async function () {
          await time.increase(shutdownGracePeriod + 1);

          await treasuryInstance.shutdown();
        });

        it('THEN treasury should selfdestroy itself', async function () {
          const contractCode = await web3.eth.getCode(treasuryInstance.address);
          assert.equal(contractCode, '0x', 'The contract did not selfdestroyed');
        });
      });

      describe('WHEN grace period is not over', function () {
        it('THEN shutdown should fail', async function () {
          await expectRevert(treasuryInstance.shutdown(), 'Shutdown grace period not yet over');
        });
      });
    });

    describe('GIVEN a scheduled shutdown with another proposal in progress', function () {
      const shutdownProposalID = 0;
      const otherProposalID = 1;
      beforeEach(async function () {
        treasuryInstance = await Treasury.new(gitcoinAddress, []);

        // Lock funds for voting
        await treasuryInstance.lockFunds({ value: votingStake, from: voter1 });
        await treasuryInstance.lockFunds({ value: votingStake, from: voter2 });
        await time.increase(lockedWaitingTime);

        // Create proposal
        await treasuryInstance.proposeShutdown({
          from: proposalCreator,
          value: proposalMinDeposit,
          gasPrice: 0,
        });

        // Reach quorum
        await treasuryInstance.vote(shutdownProposalID, true, { from: voter1 });

        // Pre-approve proposal
        await treasuryInstance.preApprove(shutdownProposalID);

        // Finish the debating period
        await time.increase(proposalDebatingPeriod + 1);

        // Proposal to have in progress while shutdown is scheduled
        await treasuryInstance.proposeAddClient(otherAddress, {
          from: voter2,
          value: proposalMinDeposit,
          gasPrice: 0,
        });

        // Vote for the other proposal
        await treasuryInstance.vote(otherProposalID, true, { from: voter2 });

        // Execute proposal
        await treasuryInstance.execProposal(shutdownProposalID, clientIndex);
      });

      describe('WHEN unlocking previous blocked funds by another proposal', function () {
        let balanceBeforeUnlock;
        beforeEach(async function () {
          balanceBeforeUnlock = await getBalanceBN(voter2);
          await treasuryInstance.unlockFunds(votingStake, {
            from: voter2,
            gasPrice: 0,
          });
        });

        it('THEN it should have received the funds', async function () {
          const balanceAfterUnlock = await getBalanceBN(voter2);
          balanceAfterUnlock.should.be.bignumber.equal(balanceBeforeUnlock.add(votingStake));
        });
      });

      describe('WHEN withdrawing previous blocked funds by another proposal', function () {
        let balanceBeforeDepositWithdraw;
        beforeEach(async function () {
          balanceBeforeDepositWithdraw = await getBalanceBN(voter2);
          await treasuryInstance.recoverProposalDeposit(otherProposalID, {
            from: voter2,
            gasPrice: 0,
          });
        });

        it('THEN it should have received the funds', async function () {
          const balanceAfterDepositWithdraw = await getBalanceBN(voter2);
          balanceAfterDepositWithdraw.should.be.bignumber.equal(
            balanceBeforeDepositWithdraw.add(proposalMinDeposit)
          );
        });
      });

      describe('WHEN voting another proposal', function () {
        it('THEN it should fail', async function () {
          await expectRevert(
            treasuryInstance.vote(otherProposalID, false, { from: voter2 }),
            'Shutdown in progress'
          );
        });
      });
    });

    describe('GIVEN no scheduled shutdown', function () {
      beforeEach(async function () {
        treasuryInstance = await Treasury.new(gitcoinAddress, []);
      });

      describe('WHEN shutting down', function () {
        it('THEN it should fail', async function () {
          await expectRevert(treasuryInstance.shutdown(), 'No shutdown in progress');
        });
      });
    });
  }
);
