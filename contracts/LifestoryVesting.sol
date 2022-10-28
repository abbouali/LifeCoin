// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./ILifeCoin.sol";

// @author: Abderrahmane Bouali for Lifestory

/**
 * @title Lifestory Vesting
 * Lifestory Vesting contract
 */
contract LifestoryVesting is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // LifeCoin contract
    ILifeCoin private immutable lifeCoin;
    
    struct Beneficiary {
        uint256 cliff;
        uint256 vesting;
        uint256 amountTotal;
        uint256 released;
        uint256 firstBenefit;
    }
    
    //1000000000 is the max quantity of LIFC mint (10**18 is the decimal)
    uint256 public constant MAX_RELEASED = 1000000000 * 10**18;

    // number of LIFC to be released
    uint256 public totalToRelease;

    // immutable var to define one day in timestamp
    uint256 public immutable dayTime;
    // immutable to define the start time of the vesting
    uint256 public immutable startedTime;

     /**
     * @dev constructor of LifestoryVesting
     * @param _lifeCoinAddress address of ERC20 contract of LIFC (LifeCoin)
     * @param _nbSecInDay define one day in seconds (timestamp)
     */
    constructor(address _lifeCoinAddress, uint256 _nbSecInDay) {
        lifeCoin = ILifeCoin(_lifeCoinAddress);
        dayTime = _nbSecInDay;
        startedTime = block.timestamp;
    }

    // Mapping from beneficiary address to Beneficiary structure
    mapping(address => Beneficiary) private beneficiaries;

    /**
     * @dev Emitted when `beneficiary` release `amount`
     */
    event Released(address beneficiary, uint256 amount);

    /**
     * @dev onlyOwner function to create a new beneficiary for a vesting.
     * @notice the distribution of tokens is implemented as stated in the whitepaper
     * @param _beneficiary address of the beneficiary to whom vested tokens are transferred
     * @param _amount total amount of tokens to be released at the end of the vesting
     * @param _firstBenefit amount of tokens released at the begin of the vesting
     * @param _cliff_day duration in days of the cliff after which tokens will begin to vest
     * @param _vesting_day duration in days of the period in which the tokens will vest
     */
    function createBeneficiary(
        address _beneficiary,
        uint256 _amount,
        uint256 _firstBenefit,
        uint256 _cliff_day,
        uint256 _vesting_day
    ) public onlyOwner {
        require(
            totalToRelease.add(_amount)  <= MAX_RELEASED,
            "LifestoryVesting: maximal vesting already set"
        );
        require(
            _firstBenefit <= _amount,
            "LifestoryVesting: firstBenefit higher from amount"
        );
        require(
            beneficiaries[_beneficiary].amountTotal  < 1,
            "LifestoryVesting: already a beneficiary"
        );
        require(_vesting_day > 0, "LifestoryVesting: duration must be > 0 days");
        require(_amount > 0, "LifestoryVesting: amount must be > 0");

        beneficiaries[_beneficiary] = Beneficiary(
            _cliff_day.mul(dayTime),
            _vesting_day.mul(dayTime),
            _amount,
            0,
            _firstBenefit
        );
        totalToRelease = totalToRelease.add(_amount);
    }

    /**
     * @dev see {createBeneficiary}.
     */
    function createBeneficiaryBatch(
        address[] memory _beneficiary,
        uint256[] memory _amount,
        uint256[] memory _firstBenefit,
        uint256[] memory _cliff_day,
        uint256[] memory _vesting_day
    ) public onlyOwner {
        require(
            _beneficiary.length == _amount.length
             && _amount.length == _firstBenefit.length
             && _amount.length == _cliff_day.length
             && _amount.length == _vesting_day.length,
            "LifestoryVesting: length not equal"
        );
        for (uint256 i = 0; i < _beneficiary.length; i++) {
            createBeneficiary(_beneficiary[i], _amount[i], _firstBenefit[i], _cliff_day[i], _vesting_day[i]);
        }    
    }

    /**
     * @dev view function to get Beneficiary structure 
     * @param _beneficiary address of beneficiary
     */
    function getBeneficiary(address _beneficiary)
        public
        view
        returns (Beneficiary memory)
    {
        return beneficiaries[_beneficiary];
    }

    /**
     * @dev view function to see number of LifeCoin can release at `_currentTime`
     * @param _beneficiary address of beneficiary
     * @param _currentTime time in timestamp
     */
    function getAmountReleasable(address _beneficiary, uint256 _currentTime)
        public
        view
        returns (uint256)
    {
        Beneficiary memory beneficiary = beneficiaries[_beneficiary];
        require(
            beneficiary.amountTotal > 0,
            "LifestoryVesting: beneficiary not exist"
        );

        if (_currentTime < startedTime.add(beneficiary.cliff)){
            return beneficiary.firstBenefit.sub(beneficiary.released); 
        } else if (_currentTime >= startedTime.add(beneficiary.vesting).add(beneficiary.cliff)) {
            return beneficiary.amountTotal.sub(beneficiary.released);
        } else {
            uint256 amountPerSeconds = (beneficiary.amountTotal.sub(beneficiary.firstBenefit)).div(beneficiary.vesting);
            uint256 deltaPerSeconds = _currentTime.sub(startedTime.add(beneficiary.cliff));
            uint256 amount = (deltaPerSeconds.mul(amountPerSeconds)).add(beneficiary.firstBenefit);
            return amount.sub(beneficiary.released);
        }
    }

    /**
     * @dev public function to release `_amount` of LifeCoin
     * @dev this function can only be called by beneficiary
     * @dev this function checks if your `_amount` is less or equal
     * then the maximum amount you can release at the current time
     * @param _amount the amount to release
     */
    function release(uint256 _amount)
        public
        nonReentrant
    {
        Beneficiary storage beneficiary = beneficiaries[msg.sender];
        require(
            beneficiary.amountTotal > 0,
            "LifestoryVesting: only beneficiary can release vested tokens"
        );

        uint256 entitledAmount = getAmountReleasable(msg.sender, block.timestamp);

        require(
            entitledAmount >= _amount,
            "LifestoryVesting: cannot release tokens, not enough vested tokens"
        );

        beneficiary.released = beneficiary.released.add(_amount);

        lifeCoin.mint(msg.sender, _amount);

        emit Released(msg.sender, _amount);
    }
}
