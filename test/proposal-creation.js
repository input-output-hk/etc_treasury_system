const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { proposalMinDeposit } = require('./helpers/constants.js');

const Treasury = artifacts.require('TestTreasury');

let treasuryInstance;

contract('Treasury: proposal creation', ([gitcoinAddress, client, newClient, proposalCreator]) => {
  describe('GIVEN a treasury with a client', function () {
    beforeEach(async function () {
      treasuryInstance = await Treasury.new(gitcoinAddress, [client]);
    });

    // Gitcoin client add proposal
    describe('WHEN a new client is proposed with enough deposit', function () {
      let proposalCreationResult;
      const proposalID = 0;
      beforeEach(async function () {
        proposalCreationResult = await treasuryInstance.proposeAddClient(newClient, {
          from: proposalCreator,
          value: proposalMinDeposit,
        });
      });

      it('THEN an event is sent with the new proposal', async function () {
        await expectEvent(proposalCreationResult, 'AddClientProposal', {
          _proposalID: proposalID.toString(),
          submitter: proposalCreator,
          clientToAdd: newClient,
        });
      });

      it('THEN the proposal can be queried for', async function () {
        const proposalState = await treasuryInstance.getProposalState.call(proposalID);
        assert(!!proposalState, 'Proposal was not created');
      });
    });

    describe('WHEN a new client is proposed with not enough deposit', function () {
      it('THEN the proposal creation should have failed', async function () {
        const tooSmallDeposit = proposalMinDeposit / 2;

        await expectRevert.unspecified(
          treasuryInstance.proposeAddClient(newClient, {
            from: proposalCreator,
            value: tooSmallDeposit,
          })
        );
      });
    });

    // Gitcoin client remove proposal
    describe('WHEN removal of a client is proposed with enough deposit', function () {
      let proposalCreationResult;
      const proposalID = 0;
      beforeEach(async function () {
        proposalCreationResult = await treasuryInstance.proposeRemoveClient(client, {
          from: proposalCreator,
          value: proposalMinDeposit,
        });
      });

      it('THEN an event is sent with the new proposal', async function () {
        await expectEvent(proposalCreationResult, 'RemoveClientProposal', {
          _proposalID: proposalID.toString(),
          submitter: proposalCreator,
          clientToRemove: client,
        });
      });

      it('THEN the proposal can be queried for', async function () {
        const proposalState = await treasuryInstance.getProposalState.call(proposalID);
        assert(!!proposalState, 'Proposal was not created');
      });
    });

    describe('WHEN removal of a client is proposed with not enough deposit', function () {
      it('THEN the proposal creation should have failed', async function () {
        const tooSmallDeposit = proposalMinDeposit / 2;

        await expectRevert.unspecified(
          treasuryInstance.proposeRemoveClient(newClient, {
            from: proposalCreator,
            value: tooSmallDeposit,
          })
        );
      });
    });

    // Gitcoin remove proposal
    describe('WHEN gitcoin removal is proposed with enough deposit', function () {
      let proposalCreationResult;
      const proposalID = 0;
      beforeEach(async function () {
        proposalCreationResult = await treasuryInstance.proposeRemoveGitcoin({
          from: proposalCreator,
          value: proposalMinDeposit,
        });
      });

      it('THEN an event is sent with the new proposal', async function () {
        await expectEvent(proposalCreationResult, 'RemoveGitcoinProposal', {
          _proposalID: proposalID.toString(),
          submitter: proposalCreator,
        });
      });

      it('THEN the proposal can be queried for', async function () {
        const proposalState = await treasuryInstance.getProposalState.call(proposalID);
        assert(!!proposalState, 'Proposal was not created');
      });
    });

    describe('WHEN gitcoin removal is proposed with not enough deposit', function () {
      it('THEN the proposal creation should have failed', async function () {
        const tooSmallDeposit = proposalMinDeposit / 2;

        await expectRevert.unspecified(
          treasuryInstance.proposeRemoveGitcoin({
            from: proposalCreator,
            value: tooSmallDeposit,
          })
        );
      });
    });

    // Update member address proposal
    describe('WHEN updating the address of a member is proposed with enough deposit', function () {
      let proposalCreationResult;
      const proposalID = 0;
      beforeEach(async function () {
        proposalCreationResult = await treasuryInstance.proposeUpdateMemberAddress(
          client,
          newClient,
          {
            from: proposalCreator,
            value: proposalMinDeposit,
          }
        );
      });

      it('THEN an event is sent with the new proposal', async function () {
        await expectEvent(proposalCreationResult, 'UpdateMemberAddressProposal', {
          _proposalID: proposalID.toString(),
          submitter: proposalCreator,
          oldClientAddress: client,
          newClientAddress: newClient,
        });
      });

      it('THEN the proposal can be queried for', async function () {
        const proposalState = await treasuryInstance.getProposalState.call(proposalID);
        assert(!!proposalState, 'Proposal was not created');
      });
    });

    describe('WHEN updating a member address is proposed with not enough deposit', function () {
      it('THEN the proposal creation should have failed', async function () {
        const tooSmallDeposit = proposalMinDeposit / 2;

        await expectRevert.unspecified(
          treasuryInstance.proposeUpdateMemberAddress(client, newClient, {
            from: proposalCreator,
            value: tooSmallDeposit,
          })
        );
      });
    });

    // Shutdown proposal
    describe('WHEN shutdown is proposed with enough deposit', function () {
      let proposalCreationResult;
      const proposalID = 0;
      beforeEach(async function () {
        proposalCreationResult = await treasuryInstance.proposeShutdown({
          from: proposalCreator,
          value: proposalMinDeposit,
        });
      });

      it('THEN an event is sent with the new proposal', async function () {
        await expectEvent(proposalCreationResult, 'ShutdownProposal', {
          _proposalID: proposalID.toString(),
          submitter: proposalCreator,
        });
      });

      it('THEN the proposal can be queried for', async function () {
        const proposalState = await treasuryInstance.getProposalState.call(proposalID);
        assert(!!proposalState, 'Proposal was not created');
      });
    });

    describe('WHEN shutdown is proposed with not enough deposit', function () {
      it('THEN the proposal creation should have failed', async function () {
        const tooSmallDeposit = proposalMinDeposit / 2;

        await expectRevert.unspecified(
          treasuryInstance.proposeShutdown({
            from: proposalCreator,
            value: tooSmallDeposit,
          })
        );
      });
    });
  });
});
