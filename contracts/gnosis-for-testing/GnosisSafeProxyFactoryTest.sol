// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.6;

import "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxyFactory.sol";

/// @title A ProxyFactory Contract to deploy the Gnosis Safe and perform the tests as similar as possible to the
/// real use case when one of the members is a multisig
/// @author Diego A. Bale
/// @notice This contract is just for heritage of the GnosisSafeProxyFactory contract so hardhat can compile it too
contract GnosisSafeProxyFactoryTest is GnosisSafeProxyFactory {

}
