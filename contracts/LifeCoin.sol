// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./EIP2612/IEIP2612.sol";
import "./EIP712/EIP712.sol";
import "./ILifeCoin.sol";

// @author: Abderrahmane Bouali for Lifestory


/**
 * @title LifeCoin
 * LifeCoin - Lifestory token contract (LIFC)
 */
contract LifeCoin is ILifeCoin, ERC20Capped, EIP712, IEIP2612, Ownable {
    using Counters for Counters.Counter;

    //1000000000 is the max quantity of LIFC mint (10**18 is the decimal)
    uint256 constant MAX_LIFC_SUPPLY = 1000000000 * 10**18;

    // address of first Vesting contract 
    address public vestingAddress = address(0);

    // allow or disable permit
    bool public allowPermit = true;
    // allow or disable claim
    bool public allowClaim = true;

    // Mapping of address to nonce counter
    // counter is incremented so as to prevent each signature from being used more than once  
    mapping(address => Counters.Counter) private _nonces;

    // The typehash for the data type specified in the structured data
    // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-712.md#rationale-for-typehash
    bytes32 private constant _PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    /**
     * @dev Modifier to check if the sender is a Vesting Contract
     */
    modifier onlyVestingContract() {
        require(msg.sender == vestingAddress, "LIFC: caller is not a Vesting Contract");
        _;
    }

    /**
     * @dev constructor of LifeCoin 
     * @dev initializes the {EIP712} domain separator using the `name` parameter, and setting `version` to `"1"`.
     * @dev initializes the {ERC20} using the `name` and `symbol` parameter
     */
    constructor() ERC20("LIFC", "LifeCoin") ERC20Capped(MAX_LIFC_SUPPLY) EIP712("LifeCoin", "1") {}

    /**
     * @notice view function to get the domain separator for the EIP712 structure
     */
    function DOMAIN_SEPARATOR() external view override returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @dev see {IEIP2612-nonces}.
     */
    function nonces(address owner) public view virtual override returns (uint256) {
        return _nonces[owner].current();
    }

    /**
     * @dev see {IEIP2612-permit}.
     */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual override {
        require(allowPermit, "LIFC: the permit is blocked by the admin");
        require(block.timestamp <= deadline, "LIFC: expired deadline");

        address signer = _recoverSigner(owner, spender, value, deadline, v, r, s );
        require(signer == owner, "LIFC: invalid signature");

        _approve(owner, spender, value);
    }

    /**
     * @dev the same as {permit} with transfer
     * @dev transfers the tokens directly to avoid having two gas costs for the spender.
     *
     * IMPORTANT: The same issues {IERC20-transfer} as related to transaction
     * ordering also apply here.
     * 
     * Emits an {Transfer} event
     * 
     * Requirements: same as {permit}
     */
    function claim(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual {
        require(allowClaim, "LIFC: the claim is blocked by the admin");
        require(block.timestamp <= deadline, "LIFC: expired deadline");

        address signer = _recoverSigner(owner, spender, value, deadline, v, r, s );
        require(signer == owner, "LIFC: invalid signature");

        _transfer(owner, spender, value);
    }
    
    /**
     * @dev internal function to recover signer from signature
     * @dev increment nonce of owner
     */
    function _recoverSigner(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal virtual returns (address signer) {
        bytes32 structHash = keccak256(abi.encode(_PERMIT_TYPEHASH, owner, spender, value, _useNonce(owner), deadline));

        bytes32 hash = _hashTypedDataV4(structHash);

        signer = ECDSA.recover(hash, v, r, s);
    }

    /**
     * @dev "Consume a nonce": internal function return the current value and increment.
     */
    function _useNonce(address owner) internal virtual returns (uint256 current) {
        Counters.Counter storage nonce = _nonces[owner];
        current = nonce.current();
        nonce.increment();
    }

    /**
     * @dev onlyOwner function to disable Permit
     * @param _allow boolean true to enable and false to disable 
     */
    function setAllowPermission(bool _allow) public onlyOwner {
        allowPermit = _allow;
    }

    /**
     * @dev onlyOwner function to disable Claim
     * @param _allow boolean true to enable and false to disable 
     */
    function setAllowClaiming(bool _allow) public onlyOwner {
        allowClaim = _allow;
    }

    /**
     * @dev onlyOwner function to set Vesting Contract address only once
     * @param _vesting address Contract  
     */
    function setVestingAddress(address _vesting) public onlyOwner {
        require(vestingAddress == address(0), "LIFC: Vesting Address already set");
        vestingAddress = _vesting;
    }

     /**
     * @dev onlyVestingContract function to create new coins up to the max cap
     * @param _to address receiving the coins  
     * @param _amount amount of coins to mint  
     */
    function mint(address _to, uint256 _amount) override external onlyVestingContract {
        _mint(_to, _amount);
    }
}