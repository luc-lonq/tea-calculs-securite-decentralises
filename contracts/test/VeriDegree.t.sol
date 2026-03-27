// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/VeriDegree.sol";

contract VeriDegreeTest is Test {
    VeriDegree public veriDegree;
    address public admin;
    address public minter;
    address public student;
    address public attacker;

    string internal constant TOKEN_URI = "ipfs://bafybeigdyrzt5testcid";

    function setUp() public {
        admin = address(this);
        minter = makeAddr("minter");
        student = makeAddr("student");
        attacker = makeAddr("attacker");

        veriDegree = new VeriDegree("VeriDegree", "VD");
        veriDegree.grantRole(veriDegree.MINTER_ROLE(), minter);
    }

    function testMinterRoleCanMintToken() public {
        vm.prank(minter);
        uint256 tokenId = veriDegree.mint(student, TOKEN_URI);

        assertEq(tokenId, 1);
        assertEq(veriDegree.ownerOf(tokenId), student);
        assertEq(veriDegree.balanceOf(student), 1);
    }

    function testNonMinterRevertsOnMint() public {
        vm.prank(attacker);
        vm.expectRevert();
        veriDegree.mint(student, TOKEN_URI);
    }

    function testTokenURIIsStoredIPFSURI() public {
        vm.prank(minter);
        uint256 tokenId = veriDegree.mint(student, TOKEN_URI);

        assertEq(veriDegree.tokenURI(tokenId), TOKEN_URI);
    }

    function testSoulboundTransferReverts() public {
        vm.prank(minter);
        uint256 tokenId = veriDegree.mint(student, TOKEN_URI);

        vm.prank(student);
        vm.expectRevert(VeriDegree.Soulbound.selector);
        veriDegree.transferFrom(student, attacker, tokenId);
    }

    function testSoulboundApproveReverts() public {
        vm.prank(minter);
        uint256 tokenId = veriDegree.mint(student, TOKEN_URI);

        vm.prank(student);
        vm.expectRevert(VeriDegree.Soulbound.selector);
        veriDegree.approve(attacker, tokenId);
    }
}