// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "openzeppelin-contracts/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @notice Per-asset reward buckets paid out against cumulative merkle roots.
/// Leaves are (account, asset, cumulative) in OpenZeppelin StandardMerkleTree format.
/// A root waits CHALLENGE_DELAY (guardian may veto) before claims use it, and each
/// root may commit at most RELEASE_BPS_PER_DAY of an asset's unallocated balance
/// per day elapsed since the previous root.
contract MiningPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant ETH = address(0);
    uint256 public constant RELEASE_BPS_PER_DAY = 500;
    uint256 public constant CHALLENGE_DELAY = 30 minutes;
    uint256 public constant WITHDRAW_DELAY = 48 hours;

    struct Pending {
        bytes32 root;
        uint64 publishedAt;
        uint64 prevPublishAt;
        address[] assets;
        uint256[] newCommitted;
    }

    struct Withdrawal {
        address asset;
        uint256 amount;
        address to;
        uint64 readyAt; // 0 = cancelled or executed
    }

    address public owner;
    address public publisher;
    address public guardian;

    mapping(address asset => bool) public allowed;
    mapping(address asset => uint256) public committed;
    mapping(address asset => uint256) public claimed;
    mapping(address account => mapping(address asset => uint256)) public claimedBy;

    bytes32 public root;
    uint256 public lastPublishAt;
    Pending internal pending;
    Withdrawal[] public withdrawals;

    event Funded(address indexed from, address indexed asset, uint256 amount);
    event Published(bytes32 indexed root, address[] assets, uint256[] newCommitted);
    event Promoted(bytes32 indexed root);
    event Vetoed(bytes32 indexed root);
    event Claimed(address indexed account, address indexed asset, uint256 amount);
    event AssetSet(address indexed asset, bool allowed);
    event RolesSet(address owner, address publisher, address guardian);
    event WithdrawProposed(uint256 indexed id, address indexed asset, uint256 amount, address to, uint64 readyAt);
    event WithdrawCancelled(uint256 indexed id);
    event WithdrawExecuted(uint256 indexed id);

    error Unauthorized();
    error NotAllowed();
    error BadInput();
    error PendingExists();
    error OverCap(address asset);
    error BadProof();
    error NothingToClaim();
    error OverCommitted();
    error NothingToVeto();
    error NotReady();
    error OverUnallocated();
    error TransferFailed();

    modifier onlyOwner() {
        require(msg.sender == owner, Unauthorized());
        _;
    }

    constructor(address owner_, address publisher_, address guardian_, address[] memory assets) {
        require(owner_ != address(0) && publisher_ != address(0) && guardian_ != address(0), BadInput());
        owner = owner_;
        publisher = publisher_;
        guardian = guardian_;
        for (uint256 i; i < assets.length; i++) {
            allowed[assets[i]] = true;
            emit AssetSet(assets[i], true);
        }
        lastPublishAt = block.timestamp;
        emit RolesSet(owner_, publisher_, guardian_);
    }

    // --- funding -------------------------------------------------------------

    function fund(address asset, uint256 amount) external payable {
        require(allowed[asset], NotAllowed());
        if (asset == ETH) {
            require(msg.value == amount, BadInput());
        } else {
            require(msg.value == 0, BadInput());
            IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        }
        emit Funded(msg.sender, asset, amount);
    }

    // --- settlement ----------------------------------------------------------

    /// @param assets strictly ascending, so an asset cannot appear twice
    function publish(bytes32 newRoot, address[] calldata assets, uint256[] calldata newCommitted) external {
        require(msg.sender == publisher, Unauthorized());
        _promote();
        require(pending.root == bytes32(0), PendingExists());
        require(newRoot != bytes32(0) && assets.length == newCommitted.length, BadInput());
        uint256 elapsed = block.timestamp - lastPublishAt;
        for (uint256 i; i < assets.length; i++) {
            address a = assets[i];
            require(i == 0 || a > assets[i - 1], BadInput());
            uint256 c = committed[a];
            require(newCommitted[i] >= c, BadInput());
            uint256 free = _unallocated(a);
            uint256 cap = free * RELEASE_BPS_PER_DAY * elapsed / (1 days * 10_000);
            if (cap > free) cap = free;
            require(newCommitted[i] - c <= cap, OverCap(a));
        }
        pending = Pending(newRoot, uint64(block.timestamp), uint64(lastPublishAt), assets, newCommitted);
        lastPublishAt = block.timestamp;
        emit Published(newRoot, assets, newCommitted);
    }

    function veto() external {
        require(msg.sender == guardian, Unauthorized());
        require(
            pending.root != bytes32(0) && block.timestamp < pending.publishedAt + CHALLENGE_DELAY, NothingToVeto()
        );
        lastPublishAt = pending.prevPublishAt;
        emit Vetoed(pending.root);
        delete pending;
    }

    function promote() external {
        _promote();
    }

    function claim(address asset, uint256 cumulative, bytes32[] calldata proof) external nonReentrant {
        _promote();
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, asset, cumulative))));
        require(MerkleProof.verifyCalldata(proof, root, leaf), BadProof());
        uint256 done = claimedBy[msg.sender][asset];
        require(cumulative > done, NothingToClaim());
        uint256 amount = cumulative - done;
        require(claimed[asset] + amount <= committed[asset], OverCommitted());
        claimedBy[msg.sender][asset] = cumulative;
        claimed[asset] += amount;
        _send(asset, msg.sender, amount);
        emit Claimed(msg.sender, asset, amount);
    }

    // --- admin ---------------------------------------------------------------

    function setAsset(address asset, bool isAllowed) external onlyOwner {
        allowed[asset] = isAllowed;
        emit AssetSet(asset, isAllowed);
    }

    function setRoles(address owner_, address publisher_, address guardian_) external onlyOwner {
        require(owner_ != address(0) && publisher_ != address(0) && guardian_ != address(0), BadInput());
        owner = owner_;
        publisher = publisher_;
        guardian = guardian_;
        emit RolesSet(owner_, publisher_, guardian_);
    }

    function proposeWithdraw(address asset, uint256 amount, address to) external onlyOwner returns (uint256 id) {
        require(to != address(0), BadInput());
        id = withdrawals.length;
        uint64 readyAt = uint64(block.timestamp + WITHDRAW_DELAY);
        withdrawals.push(Withdrawal(asset, amount, to, readyAt));
        emit WithdrawProposed(id, asset, amount, to, readyAt);
    }

    function cancelWithdraw(uint256 id) external onlyOwner {
        withdrawals[id].readyAt = 0;
        emit WithdrawCancelled(id);
    }

    function executeWithdraw(uint256 id) external onlyOwner nonReentrant {
        Withdrawal memory w = withdrawals[id];
        require(w.readyAt != 0 && block.timestamp >= w.readyAt, NotReady());
        _promote();
        require(w.amount <= _unallocated(w.asset), OverUnallocated());
        withdrawals[id].readyAt = 0;
        _send(w.asset, w.to, w.amount);
        emit WithdrawExecuted(id);
    }

    // --- views ---------------------------------------------------------------

    function unallocated(address asset) external view returns (uint256) {
        return _unallocated(asset);
    }

    function pendingRoot()
        external
        view
        returns (bytes32 root_, uint64 publishedAt, address[] memory assets, uint256[] memory newCommitted)
    {
        return (pending.root, pending.publishedAt, pending.assets, pending.newCommitted);
    }

    // --- internal ------------------------------------------------------------

    function _promote() internal {
        if (pending.root == bytes32(0) || block.timestamp < pending.publishedAt + CHALLENGE_DELAY) return;
        for (uint256 i; i < pending.assets.length; i++) {
            committed[pending.assets[i]] = pending.newCommitted[i];
        }
        root = pending.root;
        emit Promoted(root);
        delete pending;
    }

    /// Balance not owed to anyone: excludes committed-but-unclaimed and a pending root's increase.
    function _unallocated(address asset) internal view returns (uint256) {
        uint256 bal = asset == ETH ? address(this).balance : IERC20(asset).balanceOf(address(this));
        uint256 reserved = committed[asset] - claimed[asset];
        for (uint256 i; i < pending.assets.length; i++) {
            if (pending.assets[i] == asset) reserved += pending.newCommitted[i] - committed[asset];
        }
        return bal > reserved ? bal - reserved : 0;
    }

    function _send(address asset, address to, uint256 amount) internal {
        if (asset == ETH) {
            (bool ok,) = to.call{value: amount}("");
            require(ok, TransferFailed());
        } else {
            IERC20(asset).safeTransfer(to, amount);
        }
    }
}
