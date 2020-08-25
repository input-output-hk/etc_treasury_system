pragma solidity 0.6.12;

import "./Treasury.sol";

/// @notice Contract with same behaviour as Treasury but only with constants overriden for testing
///         purposes
contract TestTreasury is Treasury {

    uint256 public constant testProposalMinDeposit = 1000;
    uint256 public constant testGitcoinRewardPerc = 10;
    uint256 public constant testProposalDebatingPeriod = 2 days;
    uint256 public constant testLockedWaitingTime = 1 days;
    uint256 public constant testProposalMajorityPerc = 60;
    uint256 public constant testProposalPreSupportPeriod = 1 days;
    uint256 public constant testShutdownGracePeriod = 1 days;

    constructor (address _gitcoinAddress, address[] memory _clients) Treasury(_gitcoinAddress, _clients) public {
        proposalMinDeposit = testProposalMinDeposit;
        gitcoinRewardPerc = testGitcoinRewardPerc;
        proposalDebatingPeriod = testProposalDebatingPeriod;
        lockedWaitingTime = testLockedWaitingTime;
        proposalMajorityPerc = testProposalMajorityPerc;
        proposalPreSupportPeriod = testProposalPreSupportPeriod;
        shutdownGracePeriod = testShutdownGracePeriod;
    }

    function proposalMinQuourum() public override pure returns(uint256) { return 1 ether; }
}
