const { time } = require('@openzeppelin/test-helpers');

const { BN, toWei } = web3.utils;

// Testing constants, should always be the same as the ones defined on TestTreasury
exports.proposalMinDeposit = new BN(1000);
exports.proposalDebatingPeriod = time.duration.days(2);
exports.proposalPreSupportPeriod = time.duration.days(1);
exports.lockedWaitingTime = time.duration.days(1);
exports.proposalMinQuorum = toWei('1', 'ether');
exports.gitcoinRewardPerc = new BN(10);
exports.shutdownGracePeriod = time.duration.days(1);
