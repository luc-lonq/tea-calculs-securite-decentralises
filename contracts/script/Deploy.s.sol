// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {VeriDegree} from "../src/VeriDegree.sol";

contract Deploy is Script {
    function run() external returns (VeriDegree deployed) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        deployed = new VeriDegree("VeriDegree", "VD");
        deployed.grantRole(deployed.MINTER_ROLE(), deployer);

        vm.stopBroadcast();
    }
}
