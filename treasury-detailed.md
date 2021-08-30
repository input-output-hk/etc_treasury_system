# **ETC Treasury detailed**

## **Motivation**

[Extracted from ECIP 1098: Proto Treasury System]  
The current approach of relying on voluntarism and benefactors to support the ETC ecosystem has failed. A clear signal needs to be sent to the wider community that ETC means to move forward with confidence with a clear vision to deliver a stable stream of funding that encourages developer engagement.

To realize this ambitious vision, innovation must be encouraged and the ETC network must be consistently maintained and continuously improved. Blockchain protocols are highly complex distributed systems that are proven to be expensive to research, develop, and implement while operating within an increasingly competitive developer market. ETC needs to position itself as a desirable platform for innovation where developers want to invest their time making improvements and building new applications.

ETC can gain a significant competitive advantage in the medium and long-term outlook by delivering a stable, decentralized, and community-driven funding system for protocol development that is backed by a clear technical roadmap. To achieve this goal, stable and reliable funding is required, under the transparent and verifiable control of the Ethereum Classic community.
<br><br>

## **Treasury Protocol Change**

Currently, when a block is successfully mined on the Ethereum Classic blockchain, the miner receives 3.2 ETC as a block reward. For now, all rewards and fees are taken by the miners who have produced the blocks; it is possible to take a portion of the reward to fund the treasury. This change proposes that the block reward is adjusted so that:

- 80% of the block reward goes to the miners
- 20% goes to the Treasury contract address
  (note: transaction fees will not be included in the treasury fund)

From that 20%, a fixed amount will be available to withdraw from a Community Grant account. And the percentage left will be distributed along the members of the Treasury equally.
These percentages can be defined at deploy time along with the Community Grant address and the rest of the members.
<br>

### **Members**

Any address can be a member of the Treasury. The contract will not check if such address is a regular wallet, another contract, a multisig, etc.
To assure this point there are automated tests in the `test` folder deploying a multisig as a member, a client owning another multisig doing withdrawals and a regular wallet from another client, interacting with the contract in the same way.
On top of that there's a script in the `scripts` folder to deploy a multisig and a Treasury contract in Sagano testnet also showing such interaction.
<br>

### **Whitelisting**

Every member should whitelist an address to perform the withdrawal. This address can be the same as the member address or can be another. The whitelisting process will store the member and its authorized address. This process will check the to-whitelist address is not present among the members and also among its own list of addresses. As said above, this address can be a contract, a wallet, a multisig, etc.
There is also a `Remove from Whitelist` process removing an already authorized address from the whitelist list.
Only a member can perform these operations. The contract will check this requirement.
<br>

### **Withdraw**

Any whitelist address can perform a `Withdraw` operation. The contract will calculate the available funds using the stored percentages, the received rewards and the member past withdrawals. With that information the amount will be transferred to the requested address.
<br>

### **Events**

- `ReceivedFunds`  
  Emitted when funds are received by the Contract

- `AddedToWhitelist`  
  Emitted when address is added to the whitelist of authorized addresses to withdraw

- `RemovedFromWhitelist`  
  Emitted when address is removed from the whitelist of authorized addresses to withdraw

- `FundsTransferred`  
  Emitted when an address withdraws funds  
  <br><br>

## **Restrictions**

Currently the Treasury will be unmutable. Which means every Member Address, including Community Grant and its percentage, will be set at deploy time.
And, at that point, the equally percentages per client calculation will be also set in the constructor of the contract.
So the deployment must be with certain address members and reward percent because there is no upgradability nor automatic migration system if a mistake gets introduced within a deployment parameter.
<br><br>

## **Migrations Strategy**

Given the above explanation and the context of this contract, there is no point in developing some kind of upgradability or automatic migration strategy. Also, who will be in charge of the upgrade ? The community consensus it's key for ETC projects to thrive.
On top of that, these approaches introduce higher security risk probabilities so it's preferable to avoid these issues.

If there's a need to change a member address, correct a percentage or any kind of modification, a new deployment should be done.
This will require a new change to the protocol by sending the reward to another contract address but the old Treasury can still be alive and any member with a whitelisted address will be able to withdraw its funds. There will be no increase in the old Treasury balance, but the already collected rewards will be still there to be withdrawn by its corresponding member.
