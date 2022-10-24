// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// @author: Abderrahmane Bouali for Lifestory


/**
 * @title LifeCoin
 * LifeCoin - Lifestory token contract (LIFC)
 */
interface ILifeCoin {
     /**
     * @dev onlyVestingContract function to create new coins up to the max cap
     * @param _to address receiving the coins  
     * @param _amount amount of coins to mint  
     */
    function mint(address _to, uint256 _amount) external;
}