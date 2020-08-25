const { time, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const {
  proposalMinDeposit,
  proposalDebatingPeriod,
  lockedWaitingTime,
  proposalMinQuorum,
} = require('./helpers/constants.js');
const { BN } = require('./helpers/helper.js');

const Treasury = artifacts.require('TestTreasury');

const donatedValue = new BN(100);
const tenPercentOfDonation = donatedValue.mul(new BN(10)).div(new BN(100));
const ninetyPercentOfDonation = donatedValue.mul(new BN(90)).div(new BN(100));
const votingStake = proposalMinQuorum;
const clientIndex = new BN(0);
let treasuryInstance;

contract(
  'Treasury: proposal execution',
  ([
    gitcoinAddress,
    newGitcoinAddress,
    client,
    newClient,
    proposalCreator,
    donator,
    voterWithFundsAvailable,
  ]) => {
    describe('GIVEN a pre-approved proposal to add a new client', function () {
      const proposalID = 0;
      beforeEach(async function () {
        treasuryInstance = await Treasury.new(gitcoinAddress, [client]);

        // Donate funds to the contract
        await treasuryInstance.sendTransaction({ value: donatedValue, from: donator });

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

        // Pre-approve proposal
        await treasuryInstance.preApprove(proposalID);
      });

      describe('WHEN executing it after debating period is over', function () {
        let execProposalResult;
        beforeEach(async function () {
          await time.increase(proposalDebatingPeriod + 1);

          execProposalResult = await treasuryInstance.execProposal(proposalID, clientIndex);
        });

        it('THEN a new client should have been added', async function () {
          const memberNumber = await treasuryInstance.getClientMembersSize.call();
          assert.equal(memberNumber.toNumber(), 2, 'Client member size was not properly updated');

          const memberClient0 = await treasuryInstance.getClientMemberAt.call(1);
          assert.equal(
            memberClient0.recipient,
            newClient,
            'Client member was not properly updated'
          );
        });

        it('AND an event is sent with the new proposal approved', async function () {
          await expectEvent(execProposalResult, 'ClientAdded', { clientAdded: newClient });
        });

        it('AND donation should have been distributed correctly', async function () {
          const amountDistributedToGitcoin = await treasuryInstance.getAvailableWithdrawBalance(
            gitcoinAddress
          );
          amountDistributedToGitcoin.should.be.bignumber.equal(tenPercentOfDonation);

          const amountDistributedToOldClient = await treasuryInstance.getAvailableWithdrawBalance(
            client
          );
          amountDistributedToOldClient.should.be.bignumber.equal(ninetyPercentOfDonation);

          const amountDistributedToNewClient = await treasuryInstance.getAvailableWithdrawBalance(
            newClient
          );
          amountDistributedToNewClient.should.be.bignumber.equal(new BN(0));
        });
      });
    });

    describe('GIVEN a pre-approved proposal to remove a client', function () {
      const proposalID = 0;
      beforeEach(async function () {
        treasuryInstance = await Treasury.new(gitcoinAddress, [client]);

        // Donate funds to the contract
        await treasuryInstance.sendTransaction({ value: donatedValue, from: donator });

        // Lock funds for voting
        await treasuryInstance.lockFunds({ value: votingStake, from: voterWithFundsAvailable });
        await time.increase(lockedWaitingTime);

        // Create proposal
        await treasuryInstance.proposeRemoveClient(client, {
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
        let execProposalResult;
        beforeEach(async function () {
          await time.increase(proposalDebatingPeriod + 1);

          execProposalResult = await treasuryInstance.execProposal(proposalID, clientIndex);
        });

        it('THEN the client should have been removed', async function () {
          const memberNumber = await treasuryInstance.getClientMembersSize.call();
          assert.equal(memberNumber.toNumber(), 0, 'Client member size was not properly updated');

          await expectRevert.assertion(treasuryInstance.getClientMemberAt(0));
        });

        it('AND an event is sent with the new proposal approved', async function () {
          await expectEvent(execProposalResult, 'ClientRemoved', { clientRemoved: client });
        });

        it('AND donation should have been distributed correctly', async function () {
          const amountDistributedToGitcoin = await treasuryInstance.getAvailableWithdrawBalance(
            gitcoinAddress
          );
          amountDistributedToGitcoin.should.be.bignumber.equal(tenPercentOfDonation);

          const amountDistributedToOldClient = await treasuryInstance.getAvailableWithdrawBalance(
            client
          );
          amountDistributedToOldClient.should.be.bignumber.equal(ninetyPercentOfDonation);

          const amountDistributedToNewClient = await treasuryInstance.getAvailableWithdrawBalance(
            newClient
          );
          amountDistributedToNewClient.should.be.bignumber.equal(new BN(0));
        });
      });
    });

    describe('GIVEN a pre-approved proposal to remove gitcoin', function () {
      const proposalID = 0;
      beforeEach(async function () {
        treasuryInstance = await Treasury.new(gitcoinAddress, [client]);

        // Donate funds to the contract
        await treasuryInstance.sendTransaction({ value: donatedValue, from: donator });

        // Lock funds for voting
        await treasuryInstance.lockFunds({ value: votingStake, from: voterWithFundsAvailable });
        await time.increase(lockedWaitingTime);

        // Create proposal
        await treasuryInstance.proposeRemoveGitcoin({
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
        let execProposalResult;
        beforeEach(async function () {
          await time.increase(proposalDebatingPeriod + 1);

          execProposalResult = await treasuryInstance.execProposal(proposalID, clientIndex);
        });

        it('THEN gitcoin should have been removed', async function () {
          await expectRevert(treasuryInstance.getGitcoinAddress(), 'Gitcoin was disabled');
        });

        it('AND an event is sent with the new proposal approved', async function () {
          await expectEvent(execProposalResult, 'GitcoinRemoved');
        });

        it('AND donation should have been distributed correctly', async function () {
          const amountDistributedToGitcoin = await treasuryInstance.getAvailableWithdrawBalance(
            gitcoinAddress
          );
          amountDistributedToGitcoin.should.be.bignumber.equal(tenPercentOfDonation);

          const amountDistributedToOldClient = await treasuryInstance.getAvailableWithdrawBalance(
            client
          );
          amountDistributedToOldClient.should.be.bignumber.equal(ninetyPercentOfDonation);
        });
      });
    });

    describe('GIVEN a pre-approved proposal to update the address of a client', function () {
      const proposalID = 0;
      beforeEach(async function () {
        treasuryInstance = await Treasury.new(gitcoinAddress, [client]);

        // Donate funds to the contract and distribute them
        await treasuryInstance.sendTransaction({ value: donatedValue, from: donator });

        // Lock funds for voting
        await treasuryInstance.lockFunds({ value: votingStake, from: voterWithFundsAvailable });
        await time.increase(lockedWaitingTime);

        // Create proposal
        await treasuryInstance.proposeUpdateMemberAddress(client, newClient, {
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
        let execProposalResult;
        beforeEach(async function () {
          await time.increase(proposalDebatingPeriod + 1);

          execProposalResult = await treasuryInstance.execProposal(proposalID, clientIndex);
        });

        it('THEN the client address should have changed', async function () {
          const memberNumber = await treasuryInstance.getClientMembersSize.call();
          assert.equal(memberNumber.toNumber(), 1, 'Client member size was not properly updated');

          const memberClient0 = await treasuryInstance.getClientMemberAt.call(0);
          assert.equal(
            memberClient0.recipient,
            newClient,
            'Client member was not properly updated'
          );
        });

        it('AND an event is sent with the new proposal approved', async function () {
          await expectEvent(execProposalResult, 'MemberAddressUpdated', {
            oldClientAddress: client,
            newClientAddress: newClient,
          });
        });

        it('AND the distribution should have been updated with the new address', async function () {
          const amountDistributedToOldClient = await treasuryInstance.getAvailableWithdrawBalance(
            client
          );
          amountDistributedToOldClient.should.be.bignumber.equal(new BN(0));

          const amountDistributedToNewClient = await treasuryInstance.getAvailableWithdrawBalance(
            newClient
          );
          amountDistributedToNewClient.should.be.bignumber.equal(ninetyPercentOfDonation);
        });
      });
    });

    describe('GIVEN a pre-approved proposal to update the address of gitcoin (after a distribution)', function () {
      const proposalID = 0;
      beforeEach(async function () {
        treasuryInstance = await Treasury.new(gitcoinAddress, [client]);

        // Donate funds to the contract and distribute them
        await treasuryInstance.sendTransaction({ value: donatedValue, from: donator });
        await treasuryInstance.distributeFunds();

        // Lock funds for voting
        await treasuryInstance.lockFunds({ value: votingStake, from: voterWithFundsAvailable });
        await time.increase(lockedWaitingTime);

        // Create proposal
        await treasuryInstance.proposeUpdateMemberAddress(gitcoinAddress, newGitcoinAddress, {
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
        let execProposalResult;
        beforeEach(async function () {
          await time.increase(proposalDebatingPeriod + 1);

          execProposalResult = await treasuryInstance.execProposal(proposalID, clientIndex);
        });

        it('THEN the gitcoin address should have changed', async function () {
          const obtainedGitcoinAddress = await treasuryInstance.getGitcoinAddress.call();
          assert.equal(
            obtainedGitcoinAddress,
            newGitcoinAddress,
            'Gitcoin member was not properly updated'
          );
        });

        it('AND an event is sent with the new proposal approved', async function () {
          await expectEvent(execProposalResult, 'MemberAddressUpdated', {
            oldClientAddress: gitcoinAddress,
            newClientAddress: newGitcoinAddress,
          });
        });

        it('AND the distribution should have been updated with the new address', async function () {
          const amountDistributedToGitcoin = await treasuryInstance.getAvailableWithdrawBalance(
            gitcoinAddress
          );
          amountDistributedToGitcoin.should.be.bignumber.equal(new BN(0));

          const amountDistributedToOldClient = await treasuryInstance.getAvailableWithdrawBalance(
            newGitcoinAddress
          );
          amountDistributedToOldClient.should.be.bignumber.equal(tenPercentOfDonation);
        });
      });
    });

    describe('GIVEN a pre-approved proposal to shutdown', function () {
      const proposalID = 0;
      beforeEach(async function () {
        treasuryInstance = await Treasury.new(gitcoinAddress, []);

        // Lock funds for voting
        await treasuryInstance.lockFunds({ value: votingStake, from: voterWithFundsAvailable });
        await time.increase(lockedWaitingTime);

        // Create proposal
        await treasuryInstance.proposeShutdown({
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
        let proposalExecutionResult;
        beforeEach(async function () {
          await time.increase(proposalDebatingPeriod + 1);

          proposalExecutionResult = await treasuryInstance.execProposal(proposalID, clientIndex);
        });

        it('THEN shutdown should be in progress', async function () {
          const withShutdownInProgress = treasuryInstance.withShutdownInProgress.call();

          assert(withShutdownInProgress, 'The contract did not schedule a shutdown');
        });

        it('AND an event is sent with the scheduled shutdown', async function () {
          await expectEvent(proposalExecutionResult, 'ShutdownScheduled');
        });
      });
    });
  }
);
