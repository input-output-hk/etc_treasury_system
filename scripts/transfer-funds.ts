/// @note This script is used to transfer funds from the hardhat named account "donator"
/// @note to the addresses defined inside the string of RECEIVERS in the env file.
/// @note It is useful for running the deploy-treasury&gnosis-testnet.tx script.
/// @note Such script requires some addresses to have funds to execute successfuly

/// @note IMPORTANT NOTE: This script can drain an account if not used properly

import { ethers, getNamedAccounts } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
/// @note this modules validates an ETC address
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WAValidator = require("wallet-validator");

const RECEIVERS = process.env.RECEIVERS || "";
const AMOUNT = process.env.AMOUNT_TO_FUND || "";

async function transferFunds(): Promise<void> {
  if (RECEIVERS == "") {
    throw new Error("Error. Receiver is not defined in env file");
  }

  if (AMOUNT == "") {
    throw new Error("Error. Amount is not defined in env file");
  }

  const DONATED_VALUE = BigNumber.from(AMOUNT);

  const namedAccounts = await getNamedAccounts();

  const donator = await ethers.getSigner(namedAccounts.donator);

  let valid;
  let msg = "";
  let txResponse;
  let receipt;

  const receiverAddressesArray = RECEIVERS.split(",");
  for (let i = 0; i < receiverAddressesArray.length; i++) {
    valid = WAValidator.validate(receiverAddressesArray[i], "ethereumclassic");

    if (!valid) {
      msg = "INVALID Address for Client: " + receiverAddressesArray[i];
      throw new Error(msg);
    }

    console.log(
      "\n\nTransfering from Donator to: ",
      receiverAddressesArray[i],
      " - Amount: ",
      DONATED_VALUE.toString(),
    );
    txResponse = await donator.sendTransaction({ to: receiverAddressesArray[i], value: DONATED_VALUE });
    receipt = await txResponse.wait();
    if (receipt.status == 0) {
      console.log("Tx - Receipt :>> ", receipt);
      throw new Error("\n\nError. Transaction failed !!");
    }

    console.log("Transfer completed for: ", receiverAddressesArray[i]);
  }

  console.log("\n ===>> Script Finished - Bye !!");
}

transferFunds()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
