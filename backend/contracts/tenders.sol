// backend/contracts/Tender.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TenderContract {
    struct Tender {
        uint id;
        string title;
        uint budget;
        bool completed;
    }

    Tender[] public tenders;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Unauthorized");
        _;
    }

    function createTender(string memory title, uint budget) public onlyOwner {
        tenders.push(Tender(tenders.length, title, budget, false));
    }

    function getTenders() public view returns (Tender[] memory) {
        return tenders;
    }
}
  