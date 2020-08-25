pragma solidity 0.6.12;

interface ITreasury {

    // ---------------------
    // EVENTS
    // ---------------------

    /// @dev emitted when a proposal to add a new client is created
    event AddClientProposal(uint256 _proposalID, address submitter, address clientToAdd);

    /// @dev emitted when a proposal to remove a client is created
    event RemoveClientProposal(uint256 _proposalID, address submitter, address clientToRemove);

    /// @dev emitted when a proposal to remove gitcoin is created
    event RemoveGitcoinProposal(uint256 _proposalID, address submitter);

    /// @dev emitted when a proposal to update the address of a member is created
    event UpdateMemberAddressProposal(uint256 _proposalID, address submitter, address oldClientAddress, address newClientAddress);

    /// @dev emitted when a proposal to shutdown treasury is created
    event ShutdownProposal(uint256 _proposalID, address submitter);


    /// @dev emitted when a client is added (after proposal execution)
    event ClientAdded(address clientAdded);

    /// @dev emitted when a client is removed (after proposal execution)
    event ClientRemoved(address clientRemoved);

    /// @dev emitted when a member address is updated (after proposal execution)
    event MemberAddressUpdated(address oldClientAddress, address newClientAddress);

    /// @dev emitted when gitcoin is removed (after proposal execution)
    event GitcoinRemoved();

    /// @dev emitted when shutdown is scheduled (after proposal execution)
    event ShutdownScheduled();

    /// @dev emitted when an unsuccessful proposal is closed
    event ClosedProposal(uint256 _proposalID);


    // ---------------------
    // WITHDRAWAL
    // ---------------------

    /// @notice Accepts donations 
    receive() external payable;

    /// @notice Calculates the funds corresponding to each member based on this.balance,
    ///         distributing the accordingly, for future withdraw by each member
    function distributeFunds() external;

    /// @notice Withdraws pending funds corresponding to the sender
    /// @return Whether the withdraw was successful or not
    function withdrawFunds() external returns(bool);


    // ---------------------
    // LOCKING/UNLOCKING
    // ---------------------

    /// @notice Locks transfered funds on the smart contract, to be eventually used for
    ///         voting proposals. The sender won't be able to use any of their locked
    ///         funds (including previous locks) till locked_waiting_time time passes
    /// @return Whether lock was successful or not
    function lockFunds() external payable returns(bool);


    /// @notice Partially unlocks senders' funds and transfers them back to the owner
    /// @param amount Funds (in wei) that the sender wants to remove
    function unlockFunds(uint256 amount) external;


    // ---------------------
    // PROPOSAL CREATION
    // ---------------------

    /// @notice Creates a proposal for adding a new client
    ///         The sender needs to send at least proposalMinDeposit, which will be exclusively
    ///         used for this proposal (and will count as positive votes) and will return to the
    ///         creator once the proposal is executed or closed
    /// @param clientToAdd the new client to be added if the proposal succeeds
    function proposeAddClient(address clientToAdd) payable external;

    /// @notice Creates a proposal for adding a removing member
    ///         The sender needs to send at least proposalMinDeposit, which will be exclusively
    ///         used for this proposal (and will count as positive votes) and will return to the
    ///         creator once the proposal is executed or closed
    /// @param clientToRemove the existing member to be removed if the proposal succeeds
    function proposeRemoveClient(address clientToRemove) payable external;

    /// @notice Creates a proposal for updating a member address
    ///         The sender needs to send at least proposalMinDeposit, which will be exclusively
    ///         used for this proposal (and will count as positive votes) and will return to the
    ///         creator once the proposal is executed or closed
    /// @param memberToUpdate the existing member to be updated if the proposal succeeds
    /// @param newMemberAddress new member address
    function proposeUpdateMemberAddress(address memberToUpdate, address newMemberAddress) payable external;

    /// @notice Creates a proposal for removing the gitcoin member
    ///         The sender needs to send at least proposalMinDeposit, which will be exclusively
    ///         used for this proposal (and will count as positive votes) and will return to the
    ///         creator once the proposal is executed or closed
    function proposeRemoveGitcoin() payable external;

    /// @notice Creates a proposal for shutting down treasury
    ///         The sender needs to send at least proposalMinDeposit, which will be exclusively
    ///         used for this proposal (and will count as positive votes) and will return to the
    ///         creator once the proposal is executed or closed
    function proposeShutdown() payable external;


    // ---------------------
    // PROPOSAL VOTING
    // ---------------------

    /// @notice Vote for a proposal, with all your unlocked staked
    ///         Requires:
    ///          - voting period to not have ended
    ///          - any locked locks already available for usage
    /// @param _proposalID of the proposal being voted on
    /// @param _supportsProposal whether the vote is in favour or against it
    function vote(uint256 _proposalID, bool _supportsProposal) external;

    /// @notice Remove the vote for a proposal
    /// @param _proposalID of the proposal from where votes are being removed
    function unvote(uint _proposalID) external;


    // ---------------------
    // PROPOSAL EXECUTION
    // ---------------------

    /// @notice Pre-approves a proposal that already reached quorum and majority in favour
    /// @param _proposalID Id of the proposal being pre-approved
    function preApprove(uint _proposalID) external;

    /// @notice Executes the proposal, calling first distributeFunds and then applying the effects of it
    ///         - Added/removed member (including gitcoin) results in change in the distribution since next block
    ///         - Updated member address results in pending and future funds for previous address to
    ///           be given to the new one
    ///         - Shutdown results in it to be scheduled after the shutdownGracePeriod
    /// @param _proposalID Id of the proposal to execute
    /// @param clientIndex For client removeal or update, the index on the members array should be passed
    function execProposal(uint256 _proposalID, uint256 clientIndex) external;

    /// @notice Closes an unsuccessful proposal. A proposal is considered unsuccessful if:
    ///          - it wasn't pre-approved
    ///          - since pre-support it lost it's quorum or majority in favour of it
    /// @param _proposalID Id of the proposal to close
    function closeProposal(uint256 _proposalID) external;

    /// @notice Allows a proposal creator to recover it's deposit once the proposal has been
    ///         closed or executed
    /// @param _proposalID Id of the proposal the deposit is being recovered
    function recoverProposalDeposit(uint _proposalID) external;


    // ---------------------
    // SHUTDOWN
    // ---------------------

    /// @notice Executes the shutdown and selfdestructs the contract
    ///         Requires a shutdown to have been scheduled shutdownGracePeriod before
    function shutdown() external;


    // ---------------------
    // QUERYING
    // ---------------------

    /// @notice Returns the available balance the member can withdraw at this moment
    function getAvailableWithdrawBalance(address memberAddress) external view returns(uint256);

    /// @notice true if there locked funds are not been blocked by a debating poposal 
    function canUnlockFunds() external view returns(bool);

    /// @notice Returns the amount locked by a participant
    /// @param participant address from which we desire to query the amount of funds
    /// @return amount locked with the participant
    function getLockedAmount(address participant) external view returns(uint256);

    /// @notice Returns the amount of active members of client type.
    function getClientMembersSize() external view returns(uint256);
    
    /// @notice Returns the address and the name of the Client member in the index array position
    function getClientMemberAt(uint256 index) external view returns(address, string memory);
    
    /// @notice Returns the address of the gitcoin members.
    function getGitcoinAddress() external view returns(address);

    /// @notice Returns the state of a proposal
    /// @return active whether the proposal was executed/closed or not
    /// @return preSupport whether the proposal has been pre-approved or not
    /// @return proposedAtTime time when the proposal was created
    /// @return endsAtTime time when the proposal voting period will end and it will be open to closing/executing
    /// @return yesVotes amount of stake in favour of the proposal
    /// @return noVotes amount of stake against a proposal
    function getProposalState(uint256 proposalId) external view returns(bool active, bool preSupport, uint256 proposedAtTime, uint256 endsAtTime, uint256 yesVotes, uint256 noVotes);

    /// @notice true if there a proposal for shutdown was executed 
    function withShutdownInProgress() external view returns(bool);
}
