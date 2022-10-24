const LifeCoin = artifacts.require("LifeCoin")
const LifestoryVesting = artifacts.require("LifestoryVesting")

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(LifeCoin)
  lifeCoin = await LifeCoin.deployed();

  await deployer.deploy(LifestoryVesting, lifeCoin.address, 86400)
  lifestoryVesting = await LifestoryVesting.deployed();

  await lifeCoin.setVestingAddress(lifestoryVesting.address);
}