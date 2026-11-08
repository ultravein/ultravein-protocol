// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {MiningPool} from "../src/MiningPool.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock", "MOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MiningPoolTest is Test {
    MiningPool pool;
    MockToken token;
    address owner = address(0xA11CE);
    address publisher = address(0xB0B);
    address guardian = address(0xC0DE);
    address alice = address(0xA1A1);
    address bob = address(0xB1B1);
    address constant ETH = address(0);

    function setUp() public {
        token = new MockToken();
        address[] memory assets = new address[](2);
        assets[0] = ETH;
        assets[1] = address(token);
        pool = new MiningPool(owner, publisher, guardian, assets);
        vm.deal(address(this), 1000 ether);
        pool.fund{value: 100 ether}(ETH, 100 ether);
        token.mint(address(this), 1000 ether);
        token.approve(address(pool), type(uint256).max);
        pool.fund(address(token), 1000 ether);
    }

    function _leaf(address account, address asset, uint256 cumulative) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(account, asset, cumulative))));
    }

    function _pair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encode(a, b)) : keccak256(abi.encode(b, a));
    }

    function _one(address asset, uint256 v) internal pure returns (address[] memory a, uint256[] memory c) {
        a = new address[](1);
        a[0] = asset;
        c = new uint256[](1);
        c[0] = v;
    }

    function _proof(bytes32 sibling) internal pure returns (bytes32[] memory p) {
        p = new bytes32[](1);
        p[0] = sibling;
    }

    // Publishes a two-leaf ETH root (alice, bob) and waits out the challenge delay.
    function _settleEth(uint256 aliceAmt, uint256 bobAmt) internal returns (bytes32 la, bytes32 lb) {
        la = _leaf(alice, ETH, aliceAmt);
        lb = _leaf(bob, ETH, bobAmt);
        (address[] memory a, uint256[] memory c) = _one(ETH, aliceAmt + bobAmt);
        vm.prank(publisher);
        pool.publish(_pair(la, lb), a, c);
        vm.warp(block.timestamp + 30 minutes);
    }

    function test_fundRejectsUnlistedAsset() public {
        vm.expectRevert(MiningPool.NotAllowed.selector);
        pool.fund(address(0xdead), 1);
    }

    function test_fundEthRequiresMatchingValue() public {
        vm.expectRevert(MiningPool.BadInput.selector);
        pool.fund{value: 1 ether}(ETH, 2 ether);
    }

    function test_onlyPublisherCanPublish() public {
        (address[] memory a, uint256[] memory c) = _one(ETH, 0);
        vm.expectRevert(MiningPool.Unauthorized.selector);
        pool.publish(bytes32(uint256(1)), a, c);
    }

    function test_publishCapScalesWithElapsedTime() public {
        vm.warp(block.timestamp + 1 days);
        // 100 ether unallocated * 5% per day * 1 day = 5 ether
        (address[] memory a, uint256[] memory c) = _one(ETH, 5 ether + 1);
        vm.expectRevert(abi.encodeWithSelector(MiningPool.OverCap.selector, ETH));
        vm.prank(publisher);
        pool.publish(bytes32(uint256(1)), a, c);
        c[0] = 5 ether;
        vm.prank(publisher);
        pool.publish(bytes32(uint256(1)), a, c);
    }

    function test_publishRejectsUnsortedAssets() public {
        vm.warp(block.timestamp + 1 days);
        address[] memory a = new address[](2);
        a[0] = address(token);
        a[1] = ETH;
        uint256[] memory c = new uint256[](2);
        vm.expectRevert(MiningPool.BadInput.selector);
        vm.prank(publisher);
        pool.publish(bytes32(uint256(1)), a, c);
    }

    function test_publishWaitsForPendingToMature() public {
        vm.warp(block.timestamp + 1 days);
        (address[] memory a, uint256[] memory c) = _one(ETH, 1 ether);
        vm.prank(publisher);
        pool.publish(bytes32(uint256(1)), a, c);
        vm.expectRevert(MiningPool.PendingExists.selector);
        vm.prank(publisher);
        pool.publish(bytes32(uint256(2)), a, c);
    }

    function test_claimBeforeDelayFails() public {
        vm.warp(block.timestamp + 1 days);
        bytes32 la = _leaf(alice, ETH, 1 ether);
        bytes32 lb = _leaf(bob, ETH, 2 ether);
        (address[] memory a, uint256[] memory c) = _one(ETH, 3 ether);
        vm.prank(publisher);
        pool.publish(_pair(la, lb), a, c);
        vm.expectRevert(MiningPool.BadProof.selector);
        vm.prank(alice);
        pool.claim(ETH, 1 ether, _proof(lb));
    }

    function test_claimPaysAndBlocksDoubleClaim() public {
        vm.warp(block.timestamp + 1 days);
        (, bytes32 lb) = _settleEth(1 ether, 2 ether);
        vm.prank(alice);
        pool.claim(ETH, 1 ether, _proof(lb));
        assertEq(alice.balance, 1 ether);
        vm.expectRevert(MiningPool.NothingToClaim.selector);
        vm.prank(alice);
        pool.claim(ETH, 1 ether, _proof(lb));
    }

    function test_wrongAmountFailsProof() public {
        vm.warp(block.timestamp + 1 days);
        (, bytes32 lb) = _settleEth(1 ether, 2 ether);
        vm.expectRevert(MiningPool.BadProof.selector);
        vm.prank(alice);
        pool.claim(ETH, 2 ether, _proof(lb));
    }

    function test_cumulativeIncreasePaysOnlyDelta() public {
        vm.warp(block.timestamp + 1 days);
        (, bytes32 lb) = _settleEth(1 ether, 2 ether);
        vm.prank(alice);
        pool.claim(ETH, 1 ether, _proof(lb));
        vm.warp(block.timestamp + 1 days);
        (, bytes32 lb2) = _settleEth(1.5 ether, 2 ether);
        vm.prank(alice);
        pool.claim(ETH, 1.5 ether, _proof(lb2));
        assertEq(alice.balance, 1.5 ether);
    }

    function test_claimErc20() public {
        vm.warp(block.timestamp + 1 days);
        bytes32 la = _leaf(alice, address(token), 10 ether);
        bytes32 lb = _leaf(bob, address(token), 20 ether);
        (address[] memory a, uint256[] memory c) = _one(address(token), 30 ether);
        vm.prank(publisher);
        pool.publish(_pair(la, lb), a, c);
        vm.warp(block.timestamp + 30 minutes);
        vm.prank(bob);
        pool.claim(address(token), 20 ether, _proof(la));
        assertEq(token.balanceOf(bob), 20 ether);
    }

    function test_vetoDiscardsPendingAndRestoresWindow() public {
        vm.warp(block.timestamp + 1 days);
        (address[] memory a, uint256[] memory c) = _one(ETH, 5 ether);
        vm.prank(publisher);
        pool.publish(bytes32(uint256(1)), a, c);
        vm.prank(guardian);
        pool.veto();
        // the full one-day window is available again
        vm.prank(publisher);
        pool.publish(bytes32(uint256(2)), a, c);
    }

    function test_vetoAfterDelayFails() public {
        vm.warp(block.timestamp + 1 days);
        _settleEth(1 ether, 2 ether);
        vm.expectRevert(MiningPool.NothingToVeto.selector);
        vm.prank(guardian);
        pool.veto();
    }

    function test_withdrawTimelock() public {
        vm.prank(owner);
        uint256 id = pool.proposeWithdraw(ETH, 10 ether, owner);
        vm.expectRevert(MiningPool.NotReady.selector);
        vm.prank(owner);
        pool.executeWithdraw(id);
        vm.warp(block.timestamp + 48 hours);
        vm.prank(owner);
        pool.executeWithdraw(id);
        assertEq(owner.balance, 10 ether);
    }

    function test_withdrawCannotTouchCommitted() public {
        vm.warp(block.timestamp + 1 days);
        _settleEth(1 ether, 2 ether);
        vm.prank(owner);
        uint256 id = pool.proposeWithdraw(ETH, 98 ether, owner);
        vm.warp(block.timestamp + 48 hours);
        vm.expectRevert(MiningPool.OverUnallocated.selector);
        vm.prank(owner);
        pool.executeWithdraw(id);
    }

    function test_withdrawCannotTouchPendingIncrease() public {
        vm.warp(block.timestamp + 1 days);
        (address[] memory a, uint256[] memory c) = _one(ETH, 5 ether);
        vm.prank(publisher);
        pool.publish(bytes32(uint256(1)), a, c);
        assertEq(pool.unallocated(ETH), 95 ether);
    }

    function test_cancelledWithdrawCannotExecute() public {
        vm.prank(owner);
        uint256 id = pool.proposeWithdraw(ETH, 1 ether, owner);
        vm.prank(owner);
        pool.cancelWithdraw(id);
        vm.warp(block.timestamp + 48 hours);
        vm.expectRevert(MiningPool.NotReady.selector);
        vm.prank(owner);
        pool.executeWithdraw(id);
    }

    function testFuzz_claimsNeverExceedCommitted(uint96 aliceAmt, uint96 bobAmt, uint96 committedAmt) public {
        vm.warp(block.timestamp + 365 days);
        uint256 cmt = bound(committedAmt, 0, 100 ether);
        bytes32 la = _leaf(alice, ETH, aliceAmt);
        bytes32 lb = _leaf(bob, ETH, bobAmt);
        (address[] memory a, uint256[] memory c) = _one(ETH, cmt);
        vm.prank(publisher);
        pool.publish(_pair(la, lb), a, c);
        vm.warp(block.timestamp + 30 minutes);
        vm.prank(alice);
        try pool.claim(ETH, aliceAmt, _proof(lb)) {} catch {}
        vm.prank(bob);
        try pool.claim(ETH, bobAmt, _proof(la)) {} catch {}
        assertLe(pool.claimed(ETH), pool.committed(ETH));
        assertLe(alice.balance + bob.balance, cmt);
    }

    // --- VGA shop ------------------------------------------------------------

    function _openShop() internal {
        uint256[] memory prices = new uint256[](4);
        prices[0] = 10 ether;
        prices[1] = 50 ether;
        prices[2] = 0; // tier 3 off sale
        prices[3] = 200 ether;
        vm.prank(owner);
        pool.setShop(address(token), prices);
        token.mint(alice, 1000 ether);
        vm.prank(alice);
        token.approve(address(pool), type(uint256).max);
    }

    function test_buyCardPaysIntoThePool() public {
        _openShop();
        uint256 before = pool.unallocated(address(token));
        vm.prank(alice);
        pool.buyCard(1);
        assertEq(pool.cardOf(alice), 1);
        assertEq(pool.unallocated(address(token)), before + 10 ether);
        assertEq(token.balanceOf(alice), 990 ether);
    }

    function test_upgradePaysOnlyTheDifference() public {
        _openShop();
        vm.startPrank(alice);
        pool.buyCard(1);
        pool.buyCard(4);
        vm.stopPrank();
        assertEq(pool.cardOf(alice), 4);
        assertEq(pool.cardSpent(alice), 200 ether);
        assertEq(token.balanceOf(alice), 800 ether);
    }

    function test_buyCardRejectsSameOrLowerTier() public {
        _openShop();
        vm.startPrank(alice);
        pool.buyCard(2);
        vm.expectRevert(MiningPool.BadInput.selector);
        pool.buyCard(2);
        vm.expectRevert(MiningPool.BadInput.selector);
        pool.buyCard(1);
        vm.stopPrank();
    }

    function test_buyCardRejectsUnpricedTier() public {
        _openShop();
        vm.prank(alice);
        vm.expectRevert(MiningPool.BadInput.selector);
        pool.buyCard(3);
    }

    function test_buyCardNeedsAListedToken() public {
        _openShop();
        vm.prank(owner);
        pool.setAsset(address(token), false);
        vm.prank(alice);
        vm.expectRevert(MiningPool.NotAllowed.selector);
        pool.buyCard(1);
    }

    function test_onlyOwnerSetsTheShop() public {
        uint256[] memory prices = new uint256[](1);
        vm.expectRevert(MiningPool.Unauthorized.selector);
        pool.setShop(address(token), prices);
    }
}
