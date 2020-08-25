const Treasury = artifacts.require('TestTreasury');

const { gitcoinRewardPerc } = require('./helpers/constants.js');
const { BN, getBalanceBN } = require('./helpers/helper.js');

let treasuryInstance;
const donatedValue = new BN(100);
const tenPercentOfDonation = donatedValue.mul(new BN(10)).div(new BN(100));

contract('Treasury: funds withdraw', ([gitcoinAddress, client1, client2, ...accounts]) => {
  describe('GIVEN a donation to a treasury without clients', function () {
    before(async function () {
      treasuryInstance = await Treasury.new(gitcoinAddress, []);

      // Send donation
      await treasuryInstance.sendTransaction({ value: donatedValue, from: accounts[0] });
    });

    describe('WHEN funds are distributed', function () {
      before(async function () {
        await treasuryInstance.distributeFunds();
      });

      it('THEN gitcoin only receives 10% of the funds', async function () {
        const amountDistributedToGitcoin = await treasuryInstance.getAvailableWithdrawBalance(
          gitcoinAddress
        );
        amountDistributedToGitcoin.should.be.bignumber.equal(tenPercentOfDonation);
      });
    });
  });

  describe('GIVEN a donation to a treasury with several clients', function () {
    before(async function () {
      treasuryInstance = await Treasury.new(gitcoinAddress, [client1, client2]);

      // Send donation
      await treasuryInstance.sendTransaction({ value: donatedValue, from: accounts[0] });
    });

    describe('WHEN funds are distributed', function () {
      before(async function () {
        await treasuryInstance.distributeFunds();
      });

      const verifyGitcoin = async function () {
        // if the percentage is changed, ensure the test breaks
        gitcoinRewardPerc.should.be.bignumber.equal('10');

        const amountDistributedToGitcoin = await treasuryInstance.getAvailableWithdrawBalance(
          gitcoinAddress
        );
        amountDistributedToGitcoin.should.be.bignumber.equal(tenPercentOfDonation);
      };

      const ninetyPercentOfDonation = donatedValue.mul(new BN(90)).div(new BN(100));
      const expectedValueDistributed = ninetyPercentOfDonation.div(new BN(2));

      const verifyClients = async function () {
        await Promise.all(
          [client1, client2].map((clientAddress) =>
            treasuryInstance
              .getAvailableWithdrawBalance(clientAddress)
              .then((amountDistributedClient) =>
                amountDistributedClient.should.be.bignumber.equal(expectedValueDistributed)
              )
          )
        );
      };

      it('THEN gitcoin receives 10% of the funds', verifyGitcoin);

      it('THEN each client receives half of the 90% remaining', verifyClients);

      describe('WHEN if distributeFunds is called again', function () {
        before(async function () {
          await treasuryInstance.distributeFunds();
        });

        it('THEN it yields the same result', async function () {
          await Promise.all([verifyGitcoin(), verifyClients()]);
        });
      });
    });
  });

  describe('GIVEN Gitcoin has funds pending for withdraw', function () {
    let accountWithPendingWithdraw;
    before(async function () {
      treasuryInstance = await Treasury.new(gitcoinAddress, []);

      // Send donation
      await treasuryInstance.sendTransaction({ value: donatedValue, from: accounts[0] });

      // Distribute the full donation to gitcoin address
      await treasuryInstance.distributeFunds();

      accountWithPendingWithdraw = gitcoinAddress;
    });

    describe('WHEN withdrawing pending funds', function () {
      let balanceBeforeWithdraw;
      before(async function () {
        balanceBeforeWithdraw = await getBalanceBN(accountWithPendingWithdraw);
        await treasuryInstance.withdrawFunds({ from: accountWithPendingWithdraw, gasPrice: 0 });
      });

      it('THEN it receives all the pending funds', async function () {
        const balanceAfterWithdraw = await getBalanceBN(accountWithPendingWithdraw);
        balanceAfterWithdraw.should.be.bignumber.equal(
          balanceBeforeWithdraw.add(tenPercentOfDonation)
        );
      });

      it('THEN it has no withdraw pending', async function () {
        const pendingWithdrawAmount = await treasuryInstance.getAvailableWithdrawBalance(
          accountWithPendingWithdraw
        );
        // Gitcoin amount should be zero
        pendingWithdrawAmount.should.be.bignumber.equal(new BN(0));
      });
    });
  });

  describe('GIVEN having no funds pending withdraw', function () {
    const accountWithNoFunds = gitcoinAddress;
    before(async function () {
      treasuryInstance = await Treasury.new(gitcoinAddress, []);
    });

    describe('WHEN withdrawing pending funds', function () {
      let withdrawResult;
      let balanceBeforeWithdraw;
      before(async function () {
        balanceBeforeWithdraw = await getBalanceBN(accountWithNoFunds);
        withdrawResult = await treasuryInstance.withdrawFunds.call({ from: accountWithNoFunds });
        await treasuryInstance.withdrawFunds({ from: accountWithNoFunds, gasPrice: 0 });
      });

      it('THEN it should fail', async function () {
        assert(!withdrawResult, 'Withdraw of no funds was successful');
      });

      it('THEN it should have received no funds', async function () {
        const balanceAfterWithdraw = await getBalanceBN(accountWithNoFunds);
        balanceAfterWithdraw.should.be.bignumber.equal(balanceBeforeWithdraw);
      });
    });
  });
});
