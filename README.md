# **ETC Treasury**

## **Summary**
This Treasury contract is a protocol change with the clear purpose of encouraging developers to engage into ETC blockchain.
Currently, when a block is successfully mined on the Ethereum Classic blockchain, the miner receives 3.2 ETC as a block reward. 
All rewards and fees are taken by the miners who have produced the blocks. This update will take a portion of the reward to fund this treasury. 
The percentages proposed are adjusted so the block reward will be split as below:
- 80% of the block reward goes to the miners
- 20% goes to the Treasury contract address 
(note: transaction fees will not be included in the treasury fund)

From that 20% going to the Treasury, a fixed amount will be available to withdraw from a Community Grant account. And the left amount will be distributed equally among the members of the Treasury.
These percentages can be defined at deploy time along with the Community Grant address and the rest of the members.

More info [`here`](./treasury-detailed.md)  
<br>

## **REQUIREMENTS**

**Install local dependencies**  
`npm install`
<br><br>

## **SECURITY CHECKS**
This will run Slither to evaluate the contract  
`npm run security-default`
<br><br>

## **DEPLOY_CONFIG FILE**

**DEPLOYMENT PARAMETERS**  
<br>
Put you configuration parameters inside the object corresponding to your Chain Id.  
Ex 1) For Sagano:

```json
deployConfig = {  
  "42": {  
    DEPLOYMENT: {        
      DEPLOYER_ADDRESS: "0x5hj713298c85d0E024C566B3ae46033D1f423F6t",
      COMM_GRANT_REWARD_PERCENT: "15000000000000000000",
      COMM_GRANT_ADDRESS: "0x34Rfg31E7kl6S8249bAFBfc8aeB2fAgh58yh9d6h",
      CLIENTS_ADDRESSES_ARRAY: "0x4Df6yUjb32fEe00AaEeaE1f5aE78e89E8a3SE4f6,0xs5GH78il2387a2172C27C949A2d59A17E432fC1B",           
      CLIENTS_NAMES_ARRAY: "client1,client2",
    },
  },
  "4": {
```

The "4" object key is for another network: Rinkeby  
<br>
- **Community Grant Reward Percent** (in BASE 18)  
`COMM_GRANT_REWARD_PERCENT: "15000000000000000000"`  
The percentage MUST BE multiplied by 10^18 to maintain the same base across the project  
Ex 1) For a 10% value,    the variable must be = 10    x 10^18 = 10000000000000000000  
Ex 2) For a 15.63% value, the variable must be = 15.36 x 10^18 = 15630000000000000000  
<br>
- **Community Grant Address**
`COMM_GRANT_ADDRESS: "0xED63e5303d440CA02050F1Dd1ED7595472D79B30"`  
<br>
- **Deployer Address**  
`DEPLOYER_ADDRESS: "0x362A9C55d54da572a7a5853171dE8Fd04d1Da800"`  
<br>
- **Clients Addresses**
`CLIENTS_ADDRESSES_ARRAY: "0xe2970A550985698D5F216de613BE799d9a466C75,0xb204Cbd646d033CebEb501bbe6474bF070008580,0x3Db130224437A409eE3785935Db0BAF866AD4fEa"`  
<br>
- **Clients Names**  
`CLIENTS_NAMES_ARRAY: "client1,client2,client3"`
<br><br>

## **BLOCKCHAIN CONNECTION**
These settings are located in the .env File.
To correctly config the .env file there's an example in the [`.env.readme`](.env.example) file
<br>
- **Mnemonic Setting**  
`MNEMONIC='abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon'`  
<br>
- **Infura Connection**  
`INFURA_API_KEY='b352dae0f0e346cfbe75969ac0000000'`  
<br>
<br>

## **BLOCKCHAIN TREASURY DEPLOY** 
Use the following command:

npx hardhat deploy --network `network-name`  

**Example for sagano network:**  
`npx hardhat deploy --network sagano`  

To deploy again with different settings, the `--reset` flag should be used:  
`npx hardhat deploy --network sagano --reset`

**Example for rinkeby network:**  
`npx hardhat deploy --network rinkeby`  
<br>

It's important that the network and chain id are configured in the [`hardhat.config`](hardhat.config.ts) file 
in the chainIds array:

```json
const chainIds = {  
  ganache: 1337,
  goerli: 5,
  hardhat: 31337,
  kovan: 42,
  mainnet: 1,
  rinkeby: 4,
  ropsten: 3,
  sagano: 42,
};
```
<br><br>

## **AVAILABLE COMMANDS**
The following commands are available to perform different operations:
### **Run Tests**
`npm run test`
<br><br>

### **Slither - Security checks**
`npm run security-default`
<br><br>

### **Coverage**
`npm run coverage`  
Browse then to *./coverage/index.html* for a more in depth report
<br><br>

### **Documentation Generator**
`npm run docgen`  
Browse then to *./docs/index.html* to view the generated documentation
<br><br>

### **Clean typescript definition, artifacts and abis** 
`npx hardhat clean`
<br><br>

### **Compile the contracts and generate typescript file, artifacts and abis**
`npx hardhat compile`
<br><br>



## **SCRIPTS**
There are two scripts located in the `scripts` folder. Both of the are related to the Multisig Gnosis deployment on testnet.  
See [`THIS`](./scripts/docs/scripts-readme.md) file for more information
