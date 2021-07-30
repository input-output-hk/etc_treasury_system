import { ethers, deployments } from "hardhat";
import { Treasury } from "../../typechain";

async function fixtureDeployScript(): Promise<Treasury> {
  await deployments.fixture();
  const deployedContract = await deployments.getOrNull("Treasury");
  if (deployedContract == undefined) throw new Error("No Treasury deployed. Something weird happened");
  const treasuryContract = await ethers.getContractAt("Treasury", deployedContract.address);
  return treasuryContract as Treasury;
}

export { fixtureDeployScript };
