const LifestoryVesting = artifacts.require("LifestoryVesting")
const LifeCoin = artifacts.require("LifeCoin")
const catchRevert = require("./exceptions.js").catchRevert;

const ND_SEC_IN_DAY = 3600n * 24n;
const DECIMAL = 10n**18n;
const MAX_RELEASED = 1000000000n*10n**18n;
const STEP = 10;
const NB_FAKE_BENEFICIARY = 5;

function getReleasable(start, currentTime, amount, firstBenefit, cliff, duration) {
  if (currentTime < start + cliff){
      return firstBenefit; 
  } else if (currentTime >= start + duration + cliff) {
      return amount;
  } else {
      let rest = amount-firstBenefit; 
      let amountPerSeconds =  rest / duration;
      let deltaPerSeconds = currentTime - (start+cliff);
      return deltaPerSeconds*amountPerSeconds + firstBenefit;
  }
}

function getRandomBigIntInclusive(min, max) {
  return ( (BigInt(parseInt(Math.random()*100)) *(max - min +1n)/100n) + min)
}

function getRandomEthAddress() {
  let characters = "0123456789abcdef"
  let addr = "0x"
  for(let i = 0; i < 40; i++){
    addr += characters[Math.floor(Math.random() * 16)]
  }
  return addr
}

contract("LifestoryVesting Amount", (accounts) => {
  let admin, lifestoryVesting, startedTime, beneficiaries;
  let totalReleased = 0n;

  class Beneficiary {
    constructor(address, amount, firstBenefit, cliffDay, durationDay, tokenReleaseByTime) {
      this.address = address;
      this.amount = amount;
      this.firstBenefit = firstBenefit;
      this.cliffDay = cliffDay;
      this.durationDay = durationDay;
      this.tokenReleaseByTime = tokenReleaseByTime;
    }
  }

  it(`Init LifestoryVesting with ${ND_SEC_IN_DAY}sec is 1 day`, async () => {
    admin = accounts[0];
    lifeCoin = await LifeCoin.new();
    lifestoryVesting = await LifestoryVesting.new(lifeCoin.address, ND_SEC_IN_DAY);
    await lifeCoin.setVestingAddress(lifestoryVesting.address, { from: admin });
    startedTime = BigInt((await lifestoryVesting.startedTime.call()));
    beneficiaries = [
      new Beneficiary(
        address = accounts[1],
        amount = 1000n*DECIMAL,
        firstBenefit = 200n*DECIMAL,
        cliffDay = 5n,
        durationDay = 5n,
        tokenReleaseByTime = { 0: 200n*DECIMAL, 432000: 200n*DECIMAL, 432001: (200n*DECIMAL)+1851851851851851n, 648000: 599999999999999816000n, 864000: 1000n*DECIMAL}
      ),
      new Beneficiary(
        address = accounts[2],
        amount = 900n*DECIMAL,
        firstBenefit = 100n*DECIMAL,
        cliffDay = 5n,
        durationDay = 4n,
        tokenReleaseByTime = { 0: 100n*DECIMAL, 432000: 100n*DECIMAL, 432001: (100n*DECIMAL)+2314814814814814n, 648000: 599999999999999824000n, 691200: 699999999999999788800n, 777599: 899997685185184903586n, 777600: 900n*DECIMAL}
      ),
      new Beneficiary(
        address = accounts[3],
        amount = 1100n*DECIMAL,
        firstBenefit = 100n*DECIMAL,
        cliffDay = 1n,
        durationDay = 5n,
        tokenReleaseByTime = {0: 100n*DECIMAL, 86400: 100n*DECIMAL, 86401: (100n*DECIMAL)+2314814814814814n,  172800: 299999999999999929600n, 345600: 699999999999999788800n, 518399: 1099997685185184833186n, 1000000: 1100n*DECIMAL}
      ),
      new Beneficiary(
        address = accounts[4],
        amount = 1000000n*DECIMAL,
        firstBenefit = 0n*DECIMAL,
        cliffDay = 30n,
        durationDay = 365n*3n
      ),
      new Beneficiary(
        address = accounts[5],
        amount = 2000000n*DECIMAL,
        firstBenefit = 2000000n*DECIMAL,
        cliffDay = 0n,
        durationDay = 1n
      )
    ];
    console.log("Address LifeCoin:", lifeCoin.address);
    console.log("Address Vesting:", lifestoryVesting.address);
    console.log("Started time:", startedTime);
    console.log("One day:", ND_SEC_IN_DAY, "seconds");
  });

  it("Create Beneficiaries Batch", async () => {
    let beneficiaryBatch = [];
    let amountBatch = [];
    let firstBenefitBatch = [];
    let cliffBatch = [];
    let durationBatch = [];
    for (i = 0; i < beneficiaries.length; i++) {
      beneficiaryBatch.push(beneficiaries[i].address);
      amountBatch.push(beneficiaries[i].amount);
      firstBenefitBatch.push(beneficiaries[i].firstBenefit);
      cliffBatch.push(beneficiaries[i].cliffDay);
      durationBatch.push(beneficiaries[i].durationDay);
      totalReleased += beneficiaries[i].amount;
    }
    await lifestoryVesting.createBeneficiaryBatch(beneficiaryBatch, amountBatch, firstBenefitBatch, cliffBatch, durationBatch, { from: admin });
  });
  
  it("HardCode Value: Check amount releasable", async () => {
    for (i = 0; i < beneficiaries.length; i++) {
      if (!beneficiaries[i].tokenReleaseByTime) continue;
      for (let [_time, _nbToken] of Object.entries(beneficiaries[i].tokenReleaseByTime)) {
        _time = BigInt(_time);
        let numberReleasable = (await lifestoryVesting.getAmountReleasable(beneficiaries[i].address, startedTime+_time, { from: beneficiaries[i].address })).toString();
        assert.equal(numberReleasable, _nbToken, `Beneficiaries ${i} - time: ${_time} - nbToken: ${_nbToken} - StartedTime: ${startedTime} - address ${beneficiaries[i].address}`);

        //Confirme with JS Algo  getReleasable is same result
        let numberReleasableFromJS = getReleasable(startedTime, BigInt(startedTime)+BigInt(_time), beneficiaries[i].amount, beneficiaries[i].firstBenefit, beneficiaries[i].cliffDay*ND_SEC_IN_DAY, beneficiaries[i].durationDay*ND_SEC_IN_DAY).toString()
        assert.equal(numberReleasableFromJS, _nbToken, `ALGO JS getReleasable : Beneficiaries ${i} time: ${_time}`, numberReleasableFromJS);
      }
    }
  });

  it(`Random Value: Check amount releasable (${STEP}STEP)`, async () => {
    for (i = 0; i < beneficiaries.length; i++) {
      for (j=0; j < STEP; j++) {
        _time = getRandomBigIntInclusive(0n,beneficiaries[i].durationDay*ND_SEC_IN_DAY + 5n*ND_SEC_IN_DAY);
        let numberReleasableFromJS = getReleasable(startedTime, BigInt(startedTime)+BigInt(_time), beneficiaries[i].amount, beneficiaries[i].firstBenefit, beneficiaries[i].cliffDay*ND_SEC_IN_DAY, beneficiaries[i].durationDay*ND_SEC_IN_DAY).toString()
        
        let numberReleasable = (await lifestoryVesting.getAmountReleasable(beneficiaries[i].address, startedTime+_time, { from: beneficiaries[i].address })).toString();
        assert.equal(numberReleasable, numberReleasableFromJS, `Beneficiaries ${i} - time: ${_time} - numberReleasableFromJS: ${numberReleasableFromJS} - StartedTime: ${startedTime} - address ${beneficiaries[i].address}`);
      }
    }
  });

  it(`Random Beneficiary:  Check amount releasable (${STEP}STEP) (${NB_FAKE_BENEFICIARY}BENEFICIARY)`, async () => {   
    let maxRandomReleased = (MAX_RELEASED-totalReleased)/BigInt(NB_FAKE_BENEFICIARY)

    for (i = 0; i < NB_FAKE_BENEFICIARY; i++) {
      let amount_wei = getRandomBigIntInclusive(1n,maxRandomReleased)
      
      let randomBeneficiary = new Beneficiary(
        address = getRandomEthAddress(),
        amount = amount_wei,
        firstBenefit = getRandomBigIntInclusive(0n,amount_wei),
        cliffDay = getRandomBigIntInclusive(0n,365n*5n),
        durationDay = getRandomBigIntInclusive(0n,365n*5n)
      )
      
      await lifestoryVesting.createBeneficiary(randomBeneficiary.address, randomBeneficiary.amount, randomBeneficiary.firstBenefit, randomBeneficiary.cliffDay, randomBeneficiary.durationDay, { from: admin });
      totalReleased+= amount_wei;

      for (j=0; j < STEP; j++) {
        _time = getRandomBigIntInclusive(0n,randomBeneficiary.durationDay*ND_SEC_IN_DAY + 5n*ND_SEC_IN_DAY);
        let numberReleasableFromJS = getReleasable(startedTime, BigInt(startedTime)+BigInt(_time), randomBeneficiary.amount, randomBeneficiary.firstBenefit, randomBeneficiary.cliffDay*ND_SEC_IN_DAY, randomBeneficiary.durationDay*ND_SEC_IN_DAY).toString()
        
        let numberReleasable = (await lifestoryVesting.getAmountReleasable(randomBeneficiary.address, startedTime+_time, { from: randomBeneficiary.address })).toString();
        assert.equal(numberReleasable, numberReleasableFromJS, `Beneficiaries ${i} - time: ${_time} - numberReleasableFromJS: ${numberReleasableFromJS} - StartedTime: ${startedTime} - address ${randomBeneficiary.address}`);
      }
    }
  });
  it(`Beneficiary Overflow:  Try if can overflow the maximum`, async () => {   
    let amount_wei = MAX_RELEASED-totalReleased+1n

    let overflowBeneficiary = new Beneficiary(
      address = getRandomEthAddress(),
      amount = amount_wei,
      firstBenefit = getRandomBigIntInclusive(0n,amount_wei),
      cliffDay = getRandomBigIntInclusive(0n,365n*5n),
      durationDay = getRandomBigIntInclusive(1n,365n*5n)
    )
    
    await catchRevert(lifestoryVesting.createBeneficiary(overflowBeneficiary.address, overflowBeneficiary.amount, overflowBeneficiary.firstBenefit, overflowBeneficiary.cliffDay, overflowBeneficiary.durationDay, { from: admin }), "can create beneficiary with overflow");
  });

  it(`Last Beneficiary: Fill the maximum of released`, async () => {   
    let amount_wei = MAX_RELEASED-totalReleased

    let lastBeneficiary = new Beneficiary(
      address = getRandomEthAddress(),
      amount = amount_wei,
      firstBenefit = getRandomBigIntInclusive(0n,amount_wei),
      cliffDay = getRandomBigIntInclusive(0n,365n*5n),
      durationDay = getRandomBigIntInclusive(1n,365n*5n)
    )
    
    await lifestoryVesting.createBeneficiary(lastBeneficiary.address, lastBeneficiary.amount, lastBeneficiary.firstBenefit, lastBeneficiary.cliffDay, lastBeneficiary.durationDay, { from: admin });
  });


});