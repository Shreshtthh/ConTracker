// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TenderContract {
    enum BidStatus { Submitted, UnderReview, Accepted, Rejected }
    enum TenderStatus { Open, UnderReview, Awarded, Completed, Cancelled }
    
    struct Tender {
        uint id;
        address creator;
        string title;
        string description;
        uint budget;
        uint deadline;
        TenderStatus status;
        uint createdAt;
        string ipfsDocHash;
        uint selectedBidId;
    }
    
    struct Bid {
        uint id;
        uint tenderId;
        address bidder;
        uint amount;
        string description;
        uint proposedTimelineDays;
        string ipfsDocHash;
        BidStatus status;
        uint createdAt;
    }
    
    struct Payment {
        uint id;
        uint tenderId;
        uint bidId;
        address recipient;
        uint amount;
        string description;
        bool released;
        uint createdAt;
    }
    
    Tender[] public tenders;
    Bid[] public bids;
    Payment[] public payments;
    
    address public owner;
    mapping(address => bool) public administrators;
    mapping(uint => uint[]) public tenderToBids;
    mapping(address => uint[]) public bidderToBids;
    mapping(uint => uint[]) public tenderToPayments;
    
    event TenderCreated(uint indexed tenderId, address creator, string title, uint budget);
    event TenderStatusUpdated(uint indexed tenderId, TenderStatus status);
    event BidSubmitted(uint indexed bidId, uint indexed tenderId, address bidder, uint amount);
    event BidStatusUpdated(uint indexed bidId, uint indexed tenderId, BidStatus status);
    event PaymentCreated(uint indexed paymentId, uint indexed tenderId, address recipient, uint amount);
    event PaymentReleased(uint indexed paymentId);
    
    constructor() {
        owner = msg.sender;
        administrators[msg.sender] = true;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }
    
    modifier onlyAdmin() {
        require(administrators[msg.sender], "Only administrators can perform this action");
        _;
    }
    
    modifier tenderExists(uint _tenderId) {
        require(_tenderId < tenders.length, "Tender does not exist");
        _;
    }
    
    modifier bidExists(uint _bidId) {
        require(_bidId < bids.length, "Bid does not exist");
        _;
    }
    
    modifier paymentExists(uint _paymentId) {
        require(_paymentId < payments.length, "Payment does not exist");
        _;
    }
    
    // Administrator Management
    function addAdministrator(address _admin) public onlyOwner {
        administrators[_admin] = true;
    }
    
    function removeAdministrator(address _admin) public onlyOwner {
        require(_admin != owner, "Cannot remove owner as administrator");
        administrators[_admin] = false;
    }
    
    // Tender Management
    function createTender(
        string memory _title, 
        string memory _description, 
        uint _budget, 
        uint _deadline, 
        string memory _ipfsDocHash
    ) public onlyAdmin returns (uint) {
        uint id = tenders.length;
        tenders.push(Tender({
            id: id,
            creator: msg.sender,
            title: _title,
            description: _description,
            budget: _budget,
            deadline: _deadline,
            status: TenderStatus.Open,
            createdAt: block.timestamp,
            ipfsDocHash: _ipfsDocHash,
            selectedBidId: 0
        }));
        
        emit TenderCreated(id, msg.sender, _title, _budget);
        return id;
    }
    
    function updateTenderStatus(uint _tenderId, TenderStatus _status) 
        public 
        onlyAdmin 
        tenderExists(_tenderId) 
    {
        tenders[_tenderId].status = _status;
        emit TenderStatusUpdated(_tenderId, _status);
    }
    
    function cancelTender(uint _tenderId) 
        public 
        onlyAdmin 
        tenderExists(_tenderId) 
    {
        require(tenders[_tenderId].status == TenderStatus.Open, "Can only cancel open tenders");
        tenders[_tenderId].status = TenderStatus.Cancelled;
        emit TenderStatusUpdated(_tenderId, TenderStatus.Cancelled);
    }
    
    function completeTender(uint _tenderId) 
        public 
        onlyAdmin 
        tenderExists(_tenderId) 
    {
        require(tenders[_tenderId].status == TenderStatus.Awarded, "Tender must be awarded before completion");
        tenders[_tenderId].status = TenderStatus.Completed;
        emit TenderStatusUpdated(_tenderId, TenderStatus.Completed);
    }
    
    // Bidding Management
    function submitBid(
        uint _tenderId, 
        uint _amount, 
        string memory _description, 
        uint _proposedTimelineDays, 
        string memory _ipfsDocHash
    ) 
        public 
        tenderExists(_tenderId) 
        returns (uint) 
    {
        require(tenders[_tenderId].status == TenderStatus.Open, "Tender is not open for bidding");
        require(block.timestamp < tenders[_tenderId].deadline, "Tender deadline has passed");
        
        uint id = bids.length;
        bids.push(Bid({
            id: id,
            tenderId: _tenderId,
            bidder: msg.sender,
            amount: _amount,
            description: _description,
            proposedTimelineDays: _proposedTimelineDays,
            ipfsDocHash: _ipfsDocHash,
            status: BidStatus.Submitted,
            createdAt: block.timestamp
        }));
        
        tenderToBids[_tenderId].push(id);
        bidderToBids[msg.sender].push(id);
        
        emit BidSubmitted(id, _tenderId, msg.sender, _amount);
        return id;
    }
    
    function updateBidStatus(uint _bidId, BidStatus _status) 
        public 
        onlyAdmin 
        bidExists(_bidId) 
    {
        bids[_bidId].status = _status;
        emit BidStatusUpdated(_bidId, bids[_bidId].tenderId, _status);
        
        // If bid is accepted, update tender status and record the selected bid
        if (_status == BidStatus.Accepted) {
            uint tenderId = bids[_bidId].tenderId;
            tenders[tenderId].status = TenderStatus.Awarded;
            tenders[tenderId].selectedBidId = _bidId;
            emit TenderStatusUpdated(tenderId, TenderStatus.Awarded);
            
            // Reject all other bids for this tender
            for (uint i = 0; i < tenderToBids[tenderId].length; i++) {
                uint bidId = tenderToBids[tenderId][i];
                if (bidId != _bidId && bids[bidId].status == BidStatus.Submitted) {
                    bids[bidId].status = BidStatus.Rejected;
                    emit BidStatusUpdated(bidId, tenderId, BidStatus.Rejected);
                }
            }
        }
    }
    
    // Payment Management
    function createPayment(
        uint _tenderId, 
        uint _bidId, 
        address _recipient, 
        uint _amount, 
        string memory _description
    ) 
        public 
        onlyAdmin 
        tenderExists(_tenderId) 
        bidExists(_bidId) 
        returns (uint) 
    {
        require(tenders[_tenderId].status == TenderStatus.Awarded, "Tender must be awarded to create payment");
        require(bids[_bidId].status == BidStatus.Accepted, "Bid must be accepted to create payment");
        require(bids[_bidId].tenderId == _tenderId, "Bid does not belong to the specified tender");
        require(_recipient == bids[_bidId].bidder, "Recipient must be the bid owner");
        
        uint id = payments.length;
        payments.push(Payment({
            id: id,
            tenderId: _tenderId,
            bidId: _bidId,
            recipient: _recipient,
            amount: _amount,
            description: _description,
            released: false,
            createdAt: block.timestamp
        }));
        
        tenderToPayments[_tenderId].push(id);
        
        emit PaymentCreated(id, _tenderId, _recipient, _amount);
        return id;
    }
    
    function releasePayment(uint _paymentId) 
        public 
        onlyAdmin 
        paymentExists(_paymentId) 
    {
        require(!payments[_paymentId].released, "Payment has already been released");
        
        payments[_paymentId].released = true;
        emit PaymentReleased(_paymentId);
    }
    
    // View Functions
    function getTenders() public view returns (Tender[] memory) {
        return tenders;
    }
    
    function getTender(uint _tenderId) 
        public 
        view 
        tenderExists(_tenderId) 
        returns (Tender memory) 
    {
        return tenders[_tenderId];
    }
    
    function getTenderBids(uint _tenderId) 
        public 
        view 
        tenderExists(_tenderId) 
        returns (Bid[] memory) 
    {
        uint[] memory bidIds = tenderToBids[_tenderId];
        Bid[] memory result = new Bid[](bidIds.length);
        
        for (uint i = 0; i < bidIds.length; i++) {
            result[i] = bids[bidIds[i]];
        }
        
        return result;
    }
    
    function getBidderBids(address _bidder) public view returns (Bid[] memory) {
        uint[] memory bidIds = bidderToBids[_bidder];
        Bid[] memory result = new Bid[](bidIds.length);
        
        for (uint i = 0; i < bidIds.length; i++) {
            result[i] = bids[bidIds[i]];
        }
        
        return result;
    }
    
    function getTenderPayments(uint _tenderId) 
        public 
        view 
        tenderExists(_tenderId) 
        returns (Payment[] memory) 
    {
        uint[] memory paymentIds = tenderToPayments[_tenderId];
        Payment[] memory result = new Payment[](paymentIds.length);
        
        for (uint i = 0; i < paymentIds.length; i++) {
            result[i] = payments[paymentIds[i]];
        }
        
        return result;
    }
}