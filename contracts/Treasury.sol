// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.6;
pragma abicoder v2;
import "@openzeppelin/contracts/math/SafeMath.sol";

/// @title A Treasury Contract for ETC to share part of the mining reward between clients and a Community Grant
/// @author Diego A. Bale
contract Treasury {
  using SafeMath for uint256;

  /// @notice Emitted when funds are received by the Contract
  /// @param sender The address of the funds sender
  /// @param amount The received amount
  event ReceivedFunds(address indexed sender, uint256 amount);

  /// @notice Emitted when address is added to the whitelist of authorized addresses to withdraw
  /// @param caller The actual member who owns the added address
  /// @param whitelistedAddress The address to be whitelisted
  event AddedToWhitelist(address indexed caller, address indexed whitelistedAddress);

  /// @notice Emitted when address is removed from the whitelist of authorized addresses to withdraw
  /// @param caller The actual member who owns the removed address
  /// @param removedAddress The address to be removed from whitelist
  event RemovedFromWhitelist(address indexed caller, address indexed removedAddress);

  /// @notice Emitted when an address withdraws funds
  /// @param memberAccount The address withdrawing the funds
  /// @param member The actual member and owner of caller address
  /// @param amount The withdrew amount
  event FundsTransferred(address indexed memberAccount, address indexed member, uint256 amount);

  /// @notice BASE for calculations with 18 digits
  uint256 public constant BASE = 10**18;

  /// @notice 100% to Calculate distribution
  /// @dev slither advices to define it like constant but this is a rutime calculated value
  // slither-disable-next-line constable-states
  uint256 public fullPercent = BASE.mul(100); // 100 * 10^18

  /// @dev Address 0x0 just for validation purposes
  address private constant NULL_ADDRESS = address(0);

  /// @notice Member is the structure to store members info
  struct Member {
    // Name identifying this client
    string name;
    // Amount already withdrawn by member
    uint256 withdrawnFunds;
    // Percentage of the funds to distribute
    uint256 percentage;
  }

  /// @notice The members mapping contains each member attributes
  /// @dev mapping indexed by member-address to the Member Struct
  mapping(address => Member) public members;

  /// @notice The whitelist of authorized addresses
  /// @dev mapping indexed by whitelisted address to the actual member address (Client or Community Grant)
  mapping(address => address) public authorizedAddresses;

  /// @notice Total Funds whitdrawn from Contract
  /// @dev Total Funds whitdrawn from Contract
  uint256 public totalWithdrawnFunds;

  /// @dev Allows only members of the Treasury (The first addresses when the contract was deployed)
  modifier onlyMembers() {
    require(members[msg.sender].percentage != 0, "Sender it's not a valid member of Treasury");
    _;
  }

  /// @dev Check the addressToSearch is not whitelisted
  modifier notWhitelisted(address addressToSearch) {
    require(authorizedAddresses[addressToSearch] == NULL_ADDRESS, "Address is already whitelisted");
    _;
  }

  /// @dev Check the addressToSearch is whitelisted
  modifier alreadyWhitelisted(address addressToSearch) {
    require(authorizedAddresses[addressToSearch] != NULL_ADDRESS, "Address is not whitelisted");
    _;
  }

  /// @notice The contract's constructor. It must be deployed with four parameters
  /// @notice It checks the parameters health, initialize state variables and build the members mapping
  /// @param communityGrantAddress The address of the Community Reward
  /// @param communityGrantRewardPercent_ The percentage for the Community Reward
  /// @param clientAddresses An array containing the clients addresses
  /// @param clientNames  An array containing the clients names
  constructor(
    address communityGrantAddress,
    uint256 communityGrantRewardPercent_,
    address[] memory clientAddresses,
    string[] memory clientNames
  ) {
    require(communityGrantAddress != NULL_ADDRESS, "Invalid address for Community Grant");
    require(communityGrantRewardPercent_ > 0, "Invalid Community Grant percentage. Must be greater than ZERO");
    require(communityGrantRewardPercent_ < fullPercent, "Invalid Community Grant percentage. Must be lower than 100%");

    require(clientAddresses.length > 0, "Deployed clients should be greater than One");
    addMemberAddresses(communityGrantAddress, communityGrantRewardPercent_, clientAddresses, clientNames);

    totalWithdrawnFunds = 0;
  }

  /// @notice Function to allow ether deposit
  /// @notice ReceivedFunds event is emitted here
  receive() external payable {
    require(msg.value > 0, "Cannot receive 0 Ethers");
    emit ReceivedFunds(msg.sender, msg.value);
  }

  /// @notice This function builds the members mapping and initializes its variables
  /// @notice It also checks for invalid and duplicates addresses
  function addMemberAddresses(
    address communityGrantAddress,
    uint256 communityGrantRewardPercent_,
    address[] memory clientAddresses,
    string[] memory clientNames
  ) internal {
    uint256 percentagePerClient = (fullPercent.sub(communityGrantRewardPercent_)).div(clientAddresses.length);

    Member storage member = members[communityGrantAddress];
    member.name = "CommunityGrant";
    member.withdrawnFunds = 0;
    member.percentage = communityGrantRewardPercent_;

    for (uint256 i = 0; i < clientAddresses.length; i++) {
      require(clientAddresses[i] != NULL_ADDRESS, "Invalid address for Client");
      require(members[clientAddresses[i]].percentage == 0, "Duplicated Client address found");

      member = members[clientAddresses[i]];
      member.name = clientNames[i];
      member.withdrawnFunds = 0;
      member.percentage = percentagePerClient;
    }
  }

  /// @notice Adds to the authorizedAddresses map the address parameter
  /// @notice This function can only be executed by a member address
  /// @notice The AddedToWhitelist event is emitted here
  /// @param addressToWhitelist The address to be whitelisted (added to the mapping)
  function addToWhitelist(address addressToWhitelist) external onlyMembers notWhitelisted(addressToWhitelist) {
    authorizedAddresses[addressToWhitelist] = msg.sender;
    emit AddedToWhitelist(msg.sender, addressToWhitelist);
  }

  /// @notice Removes from the authorizedAddresses map the address parameter
  /// @notice This function can only be executed by a member address
  /// @notice The RemovedFromWhitelist event is emitted here
  /// @param addressToRemove The address to be removed from the mapping
  function removeFromWhitelist(address addressToRemove) external onlyMembers alreadyWhitelisted(addressToRemove) {
    require(authorizedAddresses[addressToRemove] == msg.sender, "Caller does not own the address to be removed");
    authorizedAddresses[addressToRemove] = NULL_ADDRESS;
    emit RemovedFromWhitelist(msg.sender, addressToRemove);
  }

  /// @notice Function to withdraw the amount from the contract and send it to the caller
  /// @param to The address for sending the amount
  /// @param amount The amount to be sent
  /// @dev The disabled slitter commnad was added to prevent a false Detector
  function transferTo(address to, uint256 amount) internal {
    /// @dev this is not an arbitrary send - is being validated
    // slither-disable-next-line arbitrary-send
    (bool transferSuccessful, ) = to.call{ value: amount }("");
    require(transferSuccessful, "TransferTo function failed");
  }

  /// @notice Function to calculate all funds received
  /// @notice It adds the actual balance to all the previous withdrawn funds
  /// @return A number in wei representing all the funds received by the contract
  function getHistoryReceivedFunds() internal view returns (uint256) {
    return address(this).balance.add(totalWithdrawnFunds);
  }

  /// @notice Calculates the maximum funds to withdraw per member
  /// @notice The theoricaMaxFundsToWithdraw store the value as if the member never did a withdraw
  /// @notice The theoricaMaxFundsToWithdraw gets compared with the actual withdrawn amount for that member
  /// @notice The difference is the max amount to withdraw for that member
  /// @param memberAddress The member address of the Treasury
  /// @return maxFundsToWithdraw The amount available to withdraw for the member address
  function getMaximumFundsToWithdraw(address memberAddress) internal view returns (uint256) {
    Member storage member = members[memberAddress];
    uint256 totalFunds = getHistoryReceivedFunds();
    uint256 theoricalMaxFundsToWithdraw = (member.percentage.mul(totalFunds)).div(fullPercent);
    uint256 maxFundsToWithdraw = 0;

    if (theoricalMaxFundsToWithdraw > member.withdrawnFunds) {
      maxFundsToWithdraw = theoricalMaxFundsToWithdraw.sub(member.withdrawnFunds);
    }
    return maxFundsToWithdraw;
  }

  /// @notice Function to withdraw the available funds to each member
  /// @notice Validates the caller and its funds availability
  /// @notice The FundsTransferred event is emitted here
  /// @dev members mapping and states variables are modified here
  function withdrawFunds() external alreadyWhitelisted(msg.sender) {
    address memberAddress = authorizedAddresses[msg.sender];

    // Disabled. In theory there is no way the authorizedAddresses map contains invalid member addresses
    // require(members[memberAddress].percentage > 0, "Member Not Found. Cannot withdraw");

    uint256 amount = getMaximumFundsToWithdraw(memberAddress);
    require(amount > 0, "There are NO pending funds to withdraw for the caller-member");

    emit FundsTransferred(msg.sender, memberAddress, amount);
    members[memberAddress].withdrawnFunds = members[memberAddress].withdrawnFunds.add(amount);
    totalWithdrawnFunds = totalWithdrawnFunds.add(amount);

    transferTo(msg.sender, amount);
  }

  /// @notice Returns the actual balance of the contract
  function getContractBalance() external view returns (uint256) {
    return address(this).balance;
  }
}
