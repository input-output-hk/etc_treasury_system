const { expectRevert, time } = require('@openzeppelin/test-helpers');
const {
  proposalMinDeposit,
  lockedWaitingTime,
  proposalDebatingPeriod,
} = require('./helpers/constants.js');
const { BN, getBalanceBN } = require('./helpers/helper.js');

const Treasury = artifacts.require('TestTreasury');

const lockingAmount = new BN(10);
let treasuryInstance;

contract(
  'Treasury: stake locking',
  ([gitcoinAddress, client, accountLockingFunds, otherAccount]) => {
    describe('GIVEN a user locks Funds', function () {
      beforeEach(async function () {
        treasuryInstance = await Treasury.new(gitcoinAddress, [client]);
        // Lock funds
        await treasuryInstance.lockFunds({ value: lockingAmount, from: accountLockingFunds });
      });

      it('THEN getLockedAmount should return the locked balance', async function () {
        // Query amount locked
        const lockedFunds = await treasuryInstance.getLockedAmount(accountLockingFunds);
        lockedFunds.should.be.bignumber.equal(lockingAmount);
      });

      it('THEN he can unlock funds', async function () {
        // Unlock more funds than locked
        const canUnlockFunds = await treasuryInstance.canUnlockFunds.call({
          from: accountLockingFunds,
        });
        assert(canUnlockFunds, 'Can not unlock funds');
      });

      describe('WHEN he partially unlock funds', function () {
        it('THEN he receives the corresponding amount', async function () {
          // Unlock part of the locked funds
          const unlockingAmount = lockingAmount.div(new BN(2));

          const balanceBeforeUnlock = await getBalanceBN(accountLockingFunds);
          // Gas price set to 0 to not affect the balance of the sender
          await treasuryInstance.unlockFunds(unlockingAmount, {
            from: accountLockingFunds,
            gasPrice: 0,
          });

          // Should have 0 unlocked
          const lockedFunds = await treasuryInstance.getLockedAmount(accountLockingFunds);
          lockedFunds.should.be.bignumber.equal(lockingAmount.sub(unlockingAmount));

          // Should have received back the locked balance
          const balanceAfterUnlock = await getBalanceBN(accountLockingFunds);
          balanceAfterUnlock.should.be.bignumber.equal(balanceBeforeUnlock.add(unlockingAmount));
        });
      });

      describe('WHEN he totally unlock funds', function () {
        it('THEN he receives the corresponding amount', async function () {
          // Unlock all locked funds
          const balanceBeforeUnlock = await getBalanceBN(accountLockingFunds);
          // Gas price set to 0 to not affect the balance of the sender
          await treasuryInstance.unlockFunds(lockingAmount, {
            from: accountLockingFunds,
            gasPrice: 0,
          });

          // Should have 0 unlocked
          const lockedFunds = await treasuryInstance.getLockedAmount(accountLockingFunds);
          lockedFunds.should.be.bignumber.equal(new BN(0));

          // Should have received back the locked balance
          const balanceAfterUnlock = await getBalanceBN(accountLockingFunds);
          balanceAfterUnlock.should.be.bignumber.equal(balanceBeforeUnlock.add(lockingAmount));
        });
      });

      describe('WHEN he tries to unlock more funds than locked', function () {
        it('THEN unlockFunds fails', async function () {
          // Unlock more funds than locked
          await expectRevert(
            treasuryInstance.unlockFunds.call(lockingAmount + 1, {
              from: accountLockingFunds,
            }),
            'Not enough funds'
          );
        });
      });

      describe('WHEN he votes on a proposal', function () {
        const proposalID = 0;
        beforeEach(async function () {
          // Wait for locked waiting time to have the funds available
          await time.increase(lockedWaitingTime);
          // Create a proposal
          await treasuryInstance.proposeAddClient(otherAccount, {
            from: otherAccount,
            value: proposalMinDeposit,
          });
          // Vote on the new Proposal
          await treasuryInstance.vote(proposalID, true, { from: accountLockingFunds });
        });

        it('THEN he can not unlock funds', async function () {
          // Unlock more funds than locked
          const canUnlockFunds = await treasuryInstance.canUnlockFunds.call({
            from: accountLockingFunds,
          });
          assert(!canUnlockFunds, 'Can unlock funds');
        });

        it('AND unlockFunds funds reverts', async function () {
          await expectRevert(
            treasuryInstance.unlockFunds.call(lockingAmount, {
              from: accountLockingFunds,
            }),
            'Funds are blocked'
          );
        });

        describe('AND the proposal is closed', function () {
          beforeEach(async function () {
            // Wait for the debating period to end
            await time.increase(proposalDebatingPeriod + 1);
            // Close the proposal
            await treasuryInstance.closeProposal(proposalID);
          });

          it('THEN he can unlock funds', async function () {
            const canUnlockFunds = await treasuryInstance.canUnlockFunds.call({
              from: accountLockingFunds,
            });
            assert(canUnlockFunds, 'Cannot unlock funds');
          });
        });
      });
    });
  }
);
