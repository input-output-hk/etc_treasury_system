import { BigNumber } from "@ethersproject/bignumber";

/// @note This is equivalent to 1 x 10^18 and to 1 ether
const ONE_BASE18 = BigNumber.from(BigNumber.from(10).pow(18));

/// @note This is equivalent 100 to use as a percentage or to 100 ethers
const ONE_HUNDRED_BASE18 = BigNumber.from(ONE_BASE18.mul(100));

const ZERO = BigNumber.from(0);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const NO_CLIENTS = 0;

export { ONE_BASE18, ONE_HUNDRED_BASE18, ZERO_ADDRESS, ZERO, NO_CLIENTS };
