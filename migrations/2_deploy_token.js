const LifeCoin = artifacts.require("LifeCoin")

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(LifeCoin)
  lifeCoin = await LifeCoin.deployed();
}