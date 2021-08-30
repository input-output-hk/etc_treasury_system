## **TREASURY WITH GNOSIS DEPLOY IN TESTNET**

This file refers to the script located in:
`./scripts/deploy-treasury&gnosis-testnet.ts`

This script is an example of a Gnosis Multisig deployment as a Treasury member. It will perform the following steps:

- Deploy the Proxy, MasterCopy and Safe Contract for Multisig
- Deploy the Treasury using the multisig as Community Grant and 2 clients
- Create a Multisig Transaction and sign it with allowed addresses
- Execute Whitelist Transaction for Community Grant Multisig address to be able to withdraw
- Send a donation to the contract
- Create a Withdraw Transaction and sign it
- Execute the Whitdraw transaction to get the corresponding part for Community Grant (using multisig)
- Check Contract Balance
- Check Multisig Balance

**NOTE:** This script require several addresses to have funds. For the Sagano faucet go to:  
[`https://mantis-testnet-faucet-web.mantis.ws`](https://mantis-testnet-faucet-web.mantis.ws)

Use the faucet to transfer to the `hardhat.donator` name account.  
Then use the `./script/transfer-funds.tx` script to distribute to other addresses defined in the `.env` file by calling such script:

`npm run fund-address -- --network sagano`
<br>
<br>
To view the step by step of depoying Gnosis Safe Multisig and the Treasury Contract interaction execute:

`npm run test-treasury-gnosis -- --network sagano`  
With the funded accounts.
