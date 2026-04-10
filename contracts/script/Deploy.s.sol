// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {VeriDegree} from "../src/VeriDegree.sol";

contract Deploy is Script {
    function run() external returns (VeriDegree deployed) {
        vm.startBroadcast();

        deployed = new VeriDegree("VeriDegree", "VD");

        address deployer = msg.sender;
        address admin = vm.envOr("VERIDEGREE_ADMIN", deployer);
        address minter = vm.envOr("VERIDEGREE_MINTER", admin);

        if (admin != deployer) {
            deployed.grantRole(deployed.DEFAULT_ADMIN_ROLE(), admin);
        }

        if (minter != deployer) {
            deployed.grantRole(deployed.MINTER_ROLE(), minter);
        }

        bool revokeDeployerRoles = vm.envOr("VERIDEGREE_REVOKE_DEPLOYER_ROLES", false);

        if (revokeDeployerRoles) {
            if (minter != deployer) {
                deployed.revokeRole(deployed.MINTER_ROLE(), deployer);
            }

            if (admin != deployer) {
                deployed.revokeRole(deployed.DEFAULT_ADMIN_ROLE(), deployer);
            }
        }

        vm.stopBroadcast();
    }
}
