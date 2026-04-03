// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {VeriDegree} from "../src/VeriDegree.sol";

contract Deploy is Script {
    function run() external returns (VeriDegree deployed) {
        vm.startBroadcast();

        deployed = new VeriDegree("VeriDegree", "VD");

        vm.stopBroadcast();
    }
}
