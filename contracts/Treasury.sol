pragma solidity 0.6.12;

import "./ITreasury.sol";

contract Treasury is ITreasury {

    /** @dev Constants */
    // Minimum value required to be transfered when creating any proposal
    uint256 public proposalMinDeposit = 100 ether;
    // Percentage (out of 100) of the funds that correspond to gitcoin
    uint256 public gitcoinRewardPerc = 10;
    // Time between proposal creation and it's completion
    uint256 public proposalDebatingPeriod = 30 days;
    // Time between last lock funds and the availability for usage of any funds locked by the participant
    uint256 public lockedWaitingTime = 1 days;
    // Percentage (out of 100) of the stake on voting that have to be in favour of a proposal for it to be accepted
    uint256 public proposalMajorityPerc = 60;
    // Time before the proposalDebatingPeriod ending, for when the proposal has to be pre-approved
    uint256 public proposalPreSupportPeriod = 2 days;
    // Time since shutdown is scheduled till it can be executed
    uint256 public shutdownGracePeriod = 7 days;

    // FIXME (issue #6):
    //      min quorum was set to 30% of the total supply at the moment of development of this
    //      contract but the value should be dinamically calculated (at least based on an estimation
    //      of it)
    // Amount of ETC required to have participated on the voting for this proposal to be applicable
    function proposalMinQuourum() virtual public pure returns(uint256) { return 35000000 ether; }

    enum ProposalType { AddClient, RemoveClient, RemoveGitcoin, UpdateMemberAddress, Shutdown }

    struct Proposal {
        // EFFECT INFO
        ProposalType proposalType;
        // Meaning depends on proposalType:
        //  - AddClient: client to be added if proposal successful
        //  - RemoveClient: client to be removed if proposal successful
        //  - UpdateMemberAddress: old client address if proposal successful
        //  - RemoveGitcoin or Shutdown: this value is not used
        address votedAddress1;
        // Meaning depends on proposalType:
        //  - UpdateMemberAddress: new client address if proposal successful
        //  - AddClient, RemoveClient, RemoveGitcoin or Shutdown: this value is not used
        address votedAddress2;

        // CREATOR INFO
        address creator;
        uint256 deposit;

        // TIME INFO
        uint256 proposedAtTime;

        // VOTING INFO
        // stake in favour of proposal
        uint256 votesForYes;
        // stake against proposal
        uint256 votesForNo;
        // mapping to get the stake voted in favour by a participant
        mapping (address => uint256) votedYes;
        // mapping to get the stake voted against by a participant
        mapping (address => uint256) votedNo;

        // STATE INFO
        // True if the proposal has not been yet executed nor close
        bool active;
        // true if more tokens are in favour of the proposal than opposed to it at
        // least `proposalPreSupportPeriod` before the voting deadline
        bool preSupport;
    }

    struct LockedFunds {
        // amount locked by user
        uint256 amount;
        // last time the user locked funds
        uint256 lastLockedTime;
    }

    struct Member {
        // amount locked by user
        address recipient;
        // Name that identifies this client
        string name;
    }

    /** @dev Members */
    bool gitcoinEnabled = true;
    Member gitcoinMember;
    Member[] clients;

    /** @dev Funds distribution */
    // Map of member addresses (including already removed ones) to pending amount to withdraw
    mapping (address => uint256) pendingWithdraws;
    /// @dev Total members available funds
    uint256 totalMembersFunds = 0;

    /** @dev Proposal tracking */
    uint256 sumOfProposalDeposits = 0;
    // FIXME: should we prune executed/closed proposals?
    Proposal[] proposals;

    /** @dev Stake locking */
    // Map of participant addresses to:
    //  - amount locked
    //  - last time funds were unlocked, affects when they can be used
    mapping (address => LockedFunds) lockedFunds;
    uint256 totalLockedFunds = 0;

    // Map of address to the proposal id blocking their funds
    // During a vote the funds from a participant are blocked, that is, their funds can't be widthdrawl
    mapping (address => uint256) blocked;

    uint256 shutdownScheduledAt = 0;


    // FIXME (issue #4): should we pass the names as well?
    constructor (address _gitcoinAddress, address[] memory _clients) public {
        gitcoinMember = Member(_gitcoinAddress, "Gitcoin");
        for (uint i = 0; i < _clients.length; i++) {
            clients.push(Member(_clients[i], ""));
        }
    }

    // ---------------------
    // WITHDRAWAL
    // ---------------------

    receive() external override payable { }

    /// @dev assumes the client member list will be short enough to be iterable
    function distributeFunds() public override {

        // contract balance is compose by locks, deposits and rewards
        uint256 fundsToDistribute = 
            address(this).balance - totalLockedFunds - sumOfProposalDeposits - totalMembersFunds;
        uint256 fundsForGitcoin = 0;

        // Distribute gitcoin's funds
        if(gitcoinEnabled) {
            fundsForGitcoin = fundsToDistribute * gitcoinRewardPerc / 100;
            pendingWithdraws[gitcoinMember.recipient] += fundsForGitcoin;
            totalMembersFunds += fundsForGitcoin;
        }
        // Distribute client's funds
        // There might be some dust left that will be used for the next distribution, as it
        // will be at most clients.length (assumed to not be too large)
        if(clients.length > 0) {
            uint256 fundsForEachClient = (fundsToDistribute - fundsForGitcoin) / clients.length;
            for (uint clientIndex = 0; clientIndex < clients.length; clientIndex++) {
                pendingWithdraws[clients[clientIndex].recipient] += fundsForEachClient;
                totalMembersFunds += fundsForEachClient;
            }
        } else {
            // FIXME (issue #5): save the funds for future clients and update totalMembersFunds
        }
    }

    /// @dev Reverts if transfer fails
    function withdrawFunds() public override returns(bool) {
        uint256 pendingWithdraw = pendingWithdraws[msg.sender];

        if(pendingWithdraw == 0) {
            return false;
        } else {
            delete pendingWithdraws[msg.sender];
            totalMembersFunds -= pendingWithdraw;

            bool transferSuccessful = transferTo(msg.sender, pendingWithdraw);
            require(transferSuccessful, "Transfering pending withdraw failed");
            
            return transferSuccessful;
        }
    }


    // ---------------------
    // LOCKING/UNLOCKING
    // ---------------------

    /// @dev If the user had locked any funds previously, the will all remain unusable till pas
    function lockFunds() public override payable noShutdownScheduled returns(bool) {
        uint256 previousLockedAmount = lockedFunds[msg.sender].amount;

        lockedFunds[msg.sender] = LockedFunds (
            previousLockedAmount + msg.value,
            // all funds from users will be unusable until lockingWaitingTime has passed
            now
        );

        totalLockedFunds += msg.value;
        return true;
    }

    /// @dev transfers the amount to the sender, if available
    ///      reverts if not enought funds
    ///      reverts if funds are blocked in a proposal
    function unlockFunds(uint256 amount) public override notBlocked {
        LockedFunds memory senderlockedFunds = lockedFunds[msg.sender];

        require(senderlockedFunds.amount >= amount, 'Not enough funds');
        // Safe substraction as it was checked before
        uint256 newLockedAmount = senderlockedFunds.amount - amount;
        if (newLockedAmount == 0) {
            delete lockedFunds[msg.sender];
        } else {
            lockedFunds[msg.sender] = LockedFunds(
                newLockedAmount,
                senderlockedFunds.lastLockedTime
            );
        }

        totalLockedFunds -= amount;

        // Transfer the locked amount back to the user
        bool transferSuccessful = transferTo(msg.sender, amount);

        require(transferSuccessful, "Transfering locked funds back to participant failed");
    }

    // ---------------------
    // PROPOSAL CREATION
    // ---------------------

    function proposeAddClient(address clientToAdd) payable public override noShutdownScheduled {
        uint256 proposalID = createProposalCommon(ProposalType.AddClient);

        // Effect info
        Proposal storage proposal = proposals[proposalID];
        proposal.votedAddress1 = clientToAdd;

        emit AddClientProposal(proposalID, msg.sender, clientToAdd);
    }

    function proposeRemoveClient(address clientToRemove) payable public override noShutdownScheduled {
        uint256 proposalID = createProposalCommon(ProposalType.RemoveClient);

        // Effect info
        Proposal storage proposal = proposals[proposalID];
        proposal.votedAddress1 = clientToRemove;

        emit RemoveClientProposal(proposalID, msg.sender, clientToRemove);
    }

    function proposeRemoveGitcoin() payable public override noShutdownScheduled {
        uint256 proposalID = createProposalCommon(ProposalType.RemoveGitcoin);

        emit RemoveGitcoinProposal(proposalID, msg.sender);
    }

    function proposeUpdateMemberAddress(address memberToUpdate, address newMemberAddress) payable public override noShutdownScheduled {
        uint256 proposalID = createProposalCommon(ProposalType.UpdateMemberAddress);

        // Effect info
        Proposal storage proposal = proposals[proposalID];
        proposal.votedAddress1 = memberToUpdate;
        proposal.votedAddress2 = newMemberAddress;

        emit UpdateMemberAddressProposal(proposalID, msg.sender, memberToUpdate, newMemberAddress);
    }

    function proposeShutdown() payable public override noShutdownScheduled {
        uint256 proposalID = createProposalCommon(ProposalType.Shutdown);

        emit ShutdownProposal(proposalID, msg.sender);
    }

    // ---------------------
    // PROPOSAL VOTING
    // ---------------------

    function vote(uint256 _proposalID, bool _supportsProposal) public override noShutdownScheduled {
 
        Proposal storage proposal = proposals[_proposalID]; // invalid opcode in case of inexistant proposal
        require(now < proposal.proposedAtTime + proposalDebatingPeriod, "Debating period ended");

        LockedFunds storage voterLockedFunds = lockedFunds[msg.sender];
        require(voterLockedFunds.lastLockedTime + lockedWaitingTime <= now, "No unlocked funds available for usage");

        unRegisterVotesFor(proposal, msg.sender);

        // Vote for proposal changes
        if (_supportsProposal) {
            proposal.votesForYes += voterLockedFunds.amount;
            proposal.votedYes[msg.sender] = voterLockedFunds.amount;
        } else {
            proposal.votesForNo += voterLockedFunds.amount;
            proposal.votedNo[msg.sender] = voterLockedFunds.amount;
        }

        // Will block voter funds in this proposal if corresponds
        evalBlockingProposal(_proposalID, proposal.proposedAtTime);
    }

    function unvote(uint _proposalID) public override noShutdownScheduled {
        Proposal storage proposal = proposals[_proposalID]; // invalid opcode in case of inexistant proposal
        require(now < proposal.proposedAtTime + proposalDebatingPeriod, "Debating period ended");

        unRegisterVotesFor(proposal, msg.sender);
    }

    // ---------------------
    // PROPOSAL EXECUTION
    // ---------------------

    function preApprove(uint _proposalID) public override noShutdownScheduled {
        Proposal storage proposal = proposals[_proposalID]; // invalid opcode in case of inexistant proposal
        uint256 totalStakeVoted = proposal.votesForYes + proposal.votesForNo;

        require(!proposal.preSupport, "Already pre-approved");
        require(now <= proposal.proposedAtTime + proposalDebatingPeriod - proposalPreSupportPeriod, "Pre-approve deadline already reached");
        require(totalStakeVoted >= proposalMinQuourum(), "Not enough quorum for pre-approval");
        require(totalStakeVoted * proposalMajorityPerc / 100 <= proposal.votesForYes, "Not enough votes for yes");

        proposal.preSupport = true;
    }

    function execProposal(uint256 _proposalID, uint256 clientIndex) public override noShutdownScheduled {

        Proposal storage proposal = proposals[_proposalID]; // invalid opcode in case of inexistant proposal
        endProposal(_proposalID);

        (bool canBeExecuted, string memory errorMsg) = canBeExecuted(_proposalID);
        require(canBeExecuted, errorMsg);

        // Before introducing any change to the state, make sure all funds belongs to current memebers 
        distributeFunds();

        if (proposal.proposalType == ProposalType.AddClient) {
            addClient(proposal.votedAddress1);
        } else if (proposal.proposalType == ProposalType.RemoveClient) {
            removeClient(proposal.votedAddress1, clientIndex);
        } else if (proposal.proposalType == ProposalType.RemoveGitcoin) {
            removeGitcoin();    
        } else if (proposal.proposalType == ProposalType.UpdateMemberAddress) {
            updateMemberAddress(proposal.votedAddress1, proposal.votedAddress2, clientIndex);
        } else if (proposal.proposalType == ProposalType.Shutdown) {
            scheduleShutdown();
        }
    }

    function closeProposal(uint256 _proposalID) public override noShutdownScheduled {
        endProposal(_proposalID);

        (bool canBeExecuted, ) = canBeExecuted(_proposalID);
        require(!canBeExecuted, "Proposal can be executed");

        emit ClosedProposal(_proposalID);
    }

    function recoverProposalDeposit(uint _proposalID) public override {
        Proposal storage proposal = proposals[_proposalID]; // invalid opcode in case of inexistant proposal

        bool canRecoverDeposit = !proposal.active || withShutdownInProgress();
        require(canRecoverDeposit, "Proposal should had finished or shutdown scheduled");

        uint256 depositToReturn = proposal.deposit;
        require(depositToReturn != 0, "Proposal deposit already recovered");
        
        sumOfProposalDeposits -= depositToReturn;
        // empty the proposal deposit
        proposal.deposit = 0;
        
        bool returnDepositSuccessful = transferTo(proposal.creator, depositToReturn);
        require(returnDepositSuccessful, "Returning the deposit was not successful");
    }

    // ---------------------
    // SHUTDOWN
    // ---------------------

    function shutdown() public override {
        require(withShutdownInProgress(), "No shutdown in progress");
        require(shutdownScheduledAt + shutdownGracePeriod < now, "Shutdown grace period not yet over");

        // All funds from the contract are burned
        selfdestruct(address(0));
    }

    // ---------------------
    // QUERYING
    // ---------------------

    function getAvailableWithdrawBalance(address memberAddress) public override view returns(uint256) {
        return pendingWithdraws[memberAddress];
    }

    function getLockedAmount(address participant) public override view returns(uint256) {
        return lockedFunds[participant].amount;
    }

    function canUnlockFunds() public override view returns(bool) {
        if (withShutdownInProgress()) {
            return true;
        }

        uint256 blockingProposalID = blocked[msg.sender];
        if(proposals.length > blockingProposalID) {
            uint256 proposalDebateEndTime = proposals[blockingProposalID].proposedAtTime + proposalDebatingPeriod;
            return (now > proposalDebateEndTime);
        }
        return true;
    }

    function getClientMembersSize() public override view returns(uint256) {
        return clients.length;
    }

    function getClientMemberAt(uint256 index) public override view returns(address recipient, string memory name) {
        Member storage client = clients[index];
        (recipient, name) = (client.recipient, client.name);
    }

    function getGitcoinAddress() public override view returns(address) {
        require(gitcoinEnabled, "Gitcoin was disabled");
        return gitcoinMember.recipient;
    }

    function getProposalState(uint256 _proposalID) public override view returns(bool active, bool preSupport, uint256 proposedAtTime, uint256 endsAtTime, uint256 approvalVotes, uint256 declineVotes) {
        Proposal storage proposal = proposals[_proposalID];

        active = proposal.active;
        preSupport = proposal.preSupport;

        proposedAtTime = proposal.proposedAtTime;
        endsAtTime = proposal.proposedAtTime + proposalDebatingPeriod;

        approvalVotes = proposal.votesForYes;
        declineVotes = proposal.votesForNo;
    }

    function withShutdownInProgress() public override view returns(bool) {
        return shutdownScheduledAt != 0;
    }

    // ---------------------
    // INTERNAL
    // ---------------------

    function transferTo(address to, uint256 amount) internal returns(bool) {
        (bool transferSuccessful, ) = to.call.value(amount)("");
        return transferSuccessful;
    }

    function unRegisterVotesFor(Proposal storage proposal, address voter) internal {
        proposal.votesForYes -= proposal.votedYes[voter];
        delete proposal.votedYes[voter];

        proposal.votesForNo -= proposal.votedNo[voter];
        delete proposal.votedNo[voter];
    }

    /// @dev Shared procedure to create any proposal of _proposalType.
    ///      The proposal is included in the proposals collection
    /// @param _proposalType Proposal type to be create
    /// @return proposalID of the created Proposal
    function createProposalCommon(ProposalType _proposalType) internal withMinimumDeposit returns(uint256 proposalID) {
        Proposal memory proposal;
        proposalID = proposals.length;

        // Proposal Type
        proposal.proposalType = _proposalType;

        // Creator info
        proposal.creator = msg.sender;
        proposal.deposit = msg.value;

        // deposit are counted as yes votes
        proposal.votesForYes = msg.value;

        // Time info
        proposal.proposedAtTime = now;

        // The proposal starts as active and can receive votes
        proposal.active = true;

        proposals.push(proposal);
        sumOfProposalDeposits += proposal.deposit;
    }

    function endProposal(uint256 _proposalID) internal {
        Proposal storage proposal = proposals[_proposalID]; // invalid opcode in case of inexistant proposal

        require(proposal.proposedAtTime + proposalDebatingPeriod <= now, "Debating period in progress");
        require(proposal.active, "Ending a non active proposal");

        // The proposal is now ended
        proposal.active = false;            
    }

    function addClient(address clientToAdd) internal {
        // FIXME (issue #4): add name to the proposal or allow name owner editing
        clients.push(Member(clientToAdd, ""));
        emit ClientAdded(clientToAdd);
    }

    function removeClient(address clientToRemove, uint256 clientIndex) internal {
        Member storage clientMember = clients[clientIndex];
        require(clientMember.recipient == clientToRemove, 'Member not in index');

        // Remove the address
        if (clients.length > 0) {
            clients[clientIndex] = clients[clients.length - 1];
            clients.pop();
        }
        emit ClientRemoved(clientToRemove);
    }

    function removeGitcoin() internal {
        gitcoinEnabled = false;
        emit GitcoinRemoved();
    }

    function updateMemberAddress(address oldAddress, address newAddress, uint256 clientIndex) internal {
        // Update tracked members addresses
        if (oldAddress == gitcoinMember.recipient) {
            gitcoinMember.recipient = newAddress;
        } else {
            Member storage clientMember = clients[clientIndex];
            require(clientMember.recipient == oldAddress, 'Member not in index');

            clients[clientIndex].recipient = newAddress;
        }

        // Update the pending withdraws
        pendingWithdraws[newAddress] = pendingWithdraws[oldAddress];
        delete pendingWithdraws[oldAddress];

        emit MemberAddressUpdated(oldAddress, newAddress);
    }

    function scheduleShutdown() internal {
        // Set the treasury on schedule shutdown state
        shutdownScheduledAt = now;

        emit ShutdownScheduled();
    }

    /// @dev Evaluates it the new Proposal should block user funds, if so, updates blocked
    function evalBlockingProposal(uint256 proposalID, uint256 proposedAtTime) internal {
        uint256 currentBlockingPorposalID = blocked[msg.sender];
        Proposal storage currentBlockingPorposal = proposals[currentBlockingPorposalID];
        // As debating periods are equal, we can compare by proposal creation time
        if(proposedAtTime > currentBlockingPorposal.proposedAtTime)
            blocked[msg.sender] = proposalID;   
    }

    function canBeExecuted(uint256 _proposalID) internal view returns(bool, string memory) {
        Proposal storage proposal = proposals[_proposalID];
        uint256 totalStakeVoted = proposal.votesForYes + proposal.votesForNo;

        bool hasQuorum = totalStakeVoted >= proposalMinQuourum();
        bool hasMajorityInFavour = totalStakeVoted * proposalMajorityPerc / 100 <= proposal.votesForYes;
        bool hasPreSupport = proposal.preSupport;

        if(!hasQuorum)
            return (false, "Not enough quorum for execution");
        else if (!hasMajorityInFavour)
            return (false, "Not enough votes for yes");
        else if (!hasPreSupport)
            return (false, "Proposal should be pre-approved");
        else
            return (true, "");
    }

    modifier withMinimumDeposit() {
        require(msg.value >= proposalMinDeposit, "Deposit is lower than the minimum");
        _;
    }

    /// @dev requires that the sender has no blocked funds
    modifier notBlocked() {
        require(canUnlockFunds(), "Funds are blocked");
        _;
    }

    modifier noShutdownScheduled() {
        require(!withShutdownInProgress(), "Shutdown in progress");
        _;
    }
}
