const LifestoryVesting = artifacts.require("LifestoryVesting")
const LifeCoin = artifacts.require("LifeCoin")
const catchRevert = require("./exceptions.js").catchRevert;

const sleepFrom = (from, days) => new Promise(r => setTimeout(r, ((days*ND_SEC_IN_DAY) - (~~(Date.now() / 1000) - from))*1000 ));
const ND_SEC_IN_DAY = 5;
const DECIMAL = 1;

contract("LifestoryVesting Release", (accounts) => {
  let admin, lifestoryVesting, startedTime, beneficiary, amount, firstBenefit, cliffDay, durationDay;

  it(`Init LifestoryVesting with ${ND_SEC_IN_DAY}sec is 1 day`, async () => {
    admin = accounts[0];
    lifeCoin = await LifeCoin.new();
    lifestoryVesting = await LifestoryVesting.new(lifeCoin.address, ND_SEC_IN_DAY);
    await lifeCoin.setVestingAddress(lifestoryVesting.address, { from: admin });
    startedTime = (await lifestoryVesting.startedTime.call()).toNumber();
    beneficiary = accounts[1];
    amount = 900 * DECIMAL;
    firstBenefit = 100;
    cliffDay = 5;
    durationDay = 4;
    console.log("Address LifeCoin:", lifeCoin.address);
    console.log("Address Vesting:", lifestoryVesting.address);
    console.log("Started time:", startedTime);
    console.log("One day:",ND_SEC_IN_DAY,"seconds");
  });

  it("Create Beneficary", async () => {
    await lifestoryVesting.createBeneficiary(beneficiary, amount, firstBenefit, cliffDay, durationDay, { from: admin });
  });

  it("Try create same Beneficary", async () => {
    await catchRevert(lifestoryVesting.createBeneficiary(beneficiary, amount, firstBenefit, cliffDay, durationDay, { from: admin }), "can create same beneficiary in double");
  });

  it("Try create Beneficary with null values", async () => {
    await catchRevert(lifestoryVesting.createBeneficiary("0x7243051383c56caab6f81e27d21b889ed8bc658d", 0, 0, 0, 0, { from: admin }), "can create same beneficiary in double");
  });

  it("Amount of token releasable is equale to firstBenefit", async () => {
    let numberReleasable = (await lifestoryVesting.getAmountReleasable(beneficiary, ~~(Date.now() / 1000), {from: beneficiary})).toString();
    assert.equal(numberReleasable, firstBenefit, "first benefit error");
  });

  it("Balance of LIFC is null ", async () => {
    let balanceOf = (await lifeCoin.balanceOf(beneficiary, {from: beneficiary})).toString();
    assert.equal(balanceOf, 0, "balance not null");
  });

  it("Release first benefit amount", async () => {
    await lifestoryVesting.release(firstBenefit, {from: beneficiary})
  });

  it("Balance of LIFC is first benefit ", async () => {
    let balanceOf = (await lifeCoin.balanceOf(beneficiary, {from: beneficiary})).toString();
    assert.equal(balanceOf, firstBenefit, "balance not equal to first benefit");
  });

  it("Wait until day 1: Verify cannot release 1", async () => {
    await sleepFrom(startedTime, 1);
    await catchRevert(lifestoryVesting.release(1, { from: beneficiary }), "error can release");
  });

  it("Balance of LIFC is again equal to first benefit ", async () => {
    let balanceOf = (await lifeCoin.balanceOf(beneficiary, {from: beneficiary})).toString();
    assert.equal(balanceOf, firstBenefit, "balance not equal to first benefit");
  });

  it("Wait until day 6: Verify cannot release 201", async () => { 
    await sleepFrom(startedTime, 6);
    await catchRevert(lifestoryVesting.release(201, { from: beneficiary }), "error can release 201 at 6");
  });

  it("Balance of LIFC is again equal to first benefit ", async () => {
    let balanceOf = (await lifeCoin.balanceOf(beneficiary, {from: beneficiary})).toString();
    assert.equal(balanceOf, firstBenefit, "balance not equal to first benefit");
  });

  it("Release 200LIFC", async () => { 
    await lifestoryVesting.release(200, {from: beneficiary})
  });

  it("Balance of LIFC is equal to first benefit + 200LIFC", async () => {
    let balanceOf = (await lifeCoin.balanceOf(beneficiary, {from: beneficiary})).toString();
    assert.equal(balanceOf, (parseInt(firstBenefit)+200).toString(), "balance not equal to first benefit + 200LIFC");
  });

  it("Wait until day 9: Release amount total - (first benefit + 200LIFC )", async () => { 
    await sleepFrom(startedTime, 9);
    await lifestoryVesting.release(amount- (firstBenefit + 200), {from: beneficiary})
  });

  it("Balance of LIFC is equal to total amount released", async () => {
    let balanceOf = (await lifeCoin.balanceOf(beneficiary, {from: beneficiary})).toString();
    assert.equal(balanceOf, amount, "balance not equal to total amount");
  });

  it("Transfere 200 LIFC to an other account", async () => {
    await lifeCoin.transfer(accounts[2], 200, {from: beneficiary});
  });
  
  it("Check LIFC balance for both accounts", async () => {
    let balanceOf = (await lifeCoin.balanceOf(beneficiary, {from: beneficiary})).toString();
    assert.equal(balanceOf, amount-200, "balance 1 not equal to total amount min 200");
    
    balanceOf = (await lifeCoin.balanceOf(accounts[2], {from: beneficiary})).toString();
    assert.equal(balanceOf, 200, "balance 2 not equal to 200");
  });

  it("Check LIFC total supply", async () => {
    let totalSuply = (await lifeCoin.totalSupply()).toString();
    assert.equal(totalSuply, amount, "total supply not equale to total released");
  });

});