// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MiningPool} from "../src/MiningPool.sol";

/// env: OWNER_ADDRESS, PUBLISHER_ADDRESS, GUARDIAN_ADDRESS, optional TOKEN.
/// Without TOKEN the pool lists ETH and the stocks; the owner adds the token later with setAsset(token, true).
contract Deploy is Script {
    address constant MSFT = 0xe93237C50D904957Cf27E7B1133b510C669c2e74;
    address constant AAPL = 0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9;
    address constant NVDA = 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC;

    function run() external {
        address token = vm.envOr("TOKEN", address(0));
        address[] memory assets = new address[](token == address(0) ? 4 : 5);
        assets[0] = address(0);
        assets[1] = MSFT;
        assets[2] = AAPL;
        assets[3] = NVDA;
        if (token != address(0)) assets[4] = token;
        vm.startBroadcast();
        MiningPool pool = new MiningPool(
            vm.envAddress("OWNER_ADDRESS"), vm.envAddress("PUBLISHER_ADDRESS"), vm.envAddress("GUARDIAN_ADDRESS"), assets
        );
        vm.stopBroadcast();
        console.log("MiningPool", address(pool));
    }
}
