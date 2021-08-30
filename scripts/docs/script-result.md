`$npm run test-treasury-gnosis -- --network sagano`

> etc-treasury@1.0.0 test-treasury-gnosis $HOME/etc-treasury
> hardhat run "./scripts/deploy-treasury&gnosis-testnet.ts" "--network" "sagano"

No need to generate any newer typings.


==========================================================================

This Script will perform the following actions:

- Deploy the Proxy, MasterCopy and Safe Contract for Multisig
- Deploy the treasury using the multisig as Community Grant and 2 clients
- Create a Multisig Transaction and sign it with allowed addresses
- Execute Whitelist Transaction for Community Grant Multisig address to be able to withdraw
- Send a donation to the contract
- Create a Whitdraw Transaction and sign it
- Execute the Whitdraw transaction to get the corresponding part for Community Grant (using multisig)
- Check Contract Balance
- Check Multisig Balance


IMPORTANT NOTE: For this script to work the following NAMED ACCOUNTS must have ETC to pay gas

- donator
- deployer
- communityGrant
- communityGrantAccount2
- and the Safe contract which will be funded from donator account

For the Sagano/Mantis ETC Fawcet go to:
https://mantis-testnet-faucet-web.mantis.ws

==========================================================================


Deploying Multisig Contracts

ProxyFactory Deployed At      :>>  0x6111f76ef977b9813ac996400772811c4B501e6B
Gnosis MasterCopy Deployed At :>>  0xE0F10A25f4c8850E8d30812b7A8FD12162a36036
Gnosis Safe Deployed At       :>>  0x41A5a57f4731233C13d4A8f250B3577bEcF4D63C
Allowed Addresses :>>  [
  '0x8ae6977E3C31E7249bAFBfc8aeB2fAf8f4b25308',
  '0x51d4587C3C7af149C62d3cE2013BCCfa8f91D5c0',
  '0x048da29Fdd52242e880877bBDBB8E04445C3E425'
] 


Deploying Treasury Contract

    Treasury deployed at:  0x1E576595f58fc4F958d6a4A62bF46615a9b35ef2
    With 2 Clients
      [
  '0xBf092095C0fEe00AaEeaE1f5aE78e89E8a1C44dc',
  '0xa327fDCF5287a2172C27C949A2d59A17E432fC1B'
]
     Community Grant Multisig Address:  0x41A5a57f4731233C13d4A8f250B3577bEcF4D63C
     Reward Percent: % 10000000000000000000


Creating the Whitelist Transaction...

Signing the Whitelist transaction...

Executing/Signing the transaction...

Checking whitelist address...

Contract Balance is:               0

Funding Multisig Contract with:    100000000000000000

Contract Receiving a Donation of:  100000000000000000

Contract Balance is:               100000000000000000

Creating the Whitdraw Transaction...

Signing the Withdraw transaction

Executing/Signing the Withdraw transaction...

Contract Balance is:               90000000000000000

MultisigBalance Balance is:        110000000000000000

 ===>> Script Finished - Bye !!
$ 


