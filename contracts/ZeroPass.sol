// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[3] calldata _pubSignals
    ) external view returns (bool);
}

/**
 * @title ZeroPass
 * @dev Combines event creation and ticket issuance with privacy-preserving features
 */
contract ZeroPass is ERC721, Ownable, ReentrancyGuard {
    IVerifier public verifier;
    uint256 private _nextTokenId;
    uint256 private _nextEventId;

    enum EventStatus {
        Active,
        Completed,
        Cancelled
    }

    struct EventParams {
        string name;
        string eventURI; // Contains description, imageCID, and location JSON
        uint256 startTime;
        uint256 endTime;
        bool isOnline;
        uint256 ticketPrice;
        uint256 maxAttendees;
        bool isPrivate;
    }

    struct Event {
        uint256 eventId;
        address organizer;
        string name;
        string eventURI; // Off-chain metadata (IPFS)
        uint256 startTime;
        uint256 endTime;
        bool isOnline;
        uint256 ticketPrice;
        uint256 maxAttendees;
        uint256 ticketsSold;
        EventStatus status;
        bool isPrivate;
    }

    // Event storage
    mapping(uint256 => Event) public events;
    mapping(address => uint256[]) public organizerEvents;

    // Ticket management
    mapping(uint256 => uint256) public ticketToEvent; // tokenId => eventId
    mapping(bytes32 => uint256[]) private userTickets; // hash1 => tokenIds
    mapping(bytes32 => bool) public isTicketUsed; // hash2 => is checked in
    mapping(uint256 => mapping(bytes32 => bool)) private eventTickets; // eventId => hash1 => has ticket
    mapping(bytes32 => uint256[]) public userEvents; // hash1 => eventIds
    mapping(uint256 => mapping(address => uint256)) public walletTicketCount; // eventId => wallet address => tickets bought

    // Events
    event EventCreated(
        uint256 indexed eventId,
        address indexed organizer,
        string name,
        uint256 startTime,
        uint256 endTime,
        uint256 ticketPrice,
        uint256 maxAttendees
    );
    event EventCancelled(uint256 indexed eventId);
    event EventCompleted(uint256 indexed eventId);
    event TicketIssued(
        uint256 indexed tokenId,
        uint256 indexed eventId,
        bytes32 indexed hash1
    );
    event TicketBurned(uint256 indexed tokenId, uint256 indexed eventId);
    event RefundIssued(
        address indexed to,
        uint256 indexed eventId,
        uint256 amount
    );

    // Custom errors
    error InvalidEventId(uint256 eventId);
    error EventNotActive(uint256 eventId);
    error TicketAlreadyExists(bytes32 hash2);
    error InvalidHash();
    error EventNotFound();
    error UnauthorizedAccess();
    error EventAlreadyEnded();
    error InsufficientPayment();
    error EventSoldOut();
    error RefundFailed();

    constructor() ERC721("EventTicket", "TCKT") Ownable(msg.sender) {
        _nextTokenId = 1;
        _nextEventId = 1;
    }

    /**
     * @dev Creates a new event
     */
    function createEvent(
        EventParams calldata params
    ) external returns (uint256) {
        require(
            params.startTime > block.timestamp,
            "Start time must be in the future"
        );
        require(
            params.endTime > params.startTime,
            "End time must be after start time"
        );
        require(
            params.maxAttendees > 0,
            "Max attendees must be greater than 0"
        );

        uint256 eventId = _nextEventId++;

        Event storage newEvent = events[eventId];
        newEvent.eventId = eventId;
        newEvent.organizer = msg.sender;
        newEvent.name = params.name;
        newEvent.eventURI = params.eventURI;
        newEvent.startTime = params.startTime;
        newEvent.endTime = params.endTime;
        newEvent.isOnline = params.isOnline;
        newEvent.ticketPrice = params.ticketPrice;
        newEvent.maxAttendees = params.maxAttendees;
        newEvent.ticketsSold = 0;
        newEvent.status = EventStatus.Active;
        newEvent.isPrivate = params.isPrivate;

        organizerEvents[msg.sender].push(eventId);

        emit EventCreated(
            eventId,
            msg.sender,
            params.name,
            params.startTime,
            params.endTime,
            params.ticketPrice,
            params.maxAttendees
        );

        return eventId;
    }

    /**
     * @dev Issues a new ticket NFT with payment
     */
    function purchaseTicket(
        bytes32 hash1,
        uint256 eventId
    ) external payable nonReentrant returns (uint256) {
        Event storage eventDetails = events[eventId];

        if (hash1 == bytes32(0)) revert InvalidHash();
        if (eventDetails.eventId == 0) revert EventNotFound();
        if (eventDetails.status != EventStatus.Active)
            revert EventNotActive(eventId);
        if (block.timestamp >= eventDetails.endTime) revert EventAlreadyEnded();
        if (eventDetails.ticketsSold >= eventDetails.maxAttendees)
            revert EventSoldOut();
        if (msg.value != eventDetails.ticketPrice) revert InsufficientPayment();
        if (eventTickets[eventId][hash1])
            revert("Ticket already purchased for this identity");
        require(walletTicketCount[eventId][msg.sender] < 4, "Limit of 4 tickets per wallet reached for this event");

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        // Update ticket mappings
        walletTicketCount[eventId][msg.sender]++;
        eventTickets[eventId][hash1] = true;
        userTickets[hash1].push(tokenId);
        ticketToEvent[tokenId] = eventId;
        userEvents[hash1].push(eventId);
        eventDetails.ticketsSold++;

        // Transfer payment to event organizer
        (bool sent, ) = payable(eventDetails.organizer).call{value: msg.value}(
            ""
        );
        require(sent, "Failed to send payment to organizer");

        emit TicketIssued(tokenId, eventId, hash1);
        return tokenId;
    }

    /**
     * @dev Cancels an event and enables refunds
     */
    function cancelEvent(uint256 eventId) external {
        Event storage eventDetails = events[eventId];
        if (eventDetails.eventId == 0) revert EventNotFound();
        if (msg.sender != eventDetails.organizer && msg.sender != owner())
            revert UnauthorizedAccess();
        if (eventDetails.status != EventStatus.Active)
            revert EventNotActive(eventId);

        eventDetails.status = EventStatus.Cancelled;
        emit EventCancelled(eventId);
    }

    /**
     * @dev Burns a ticket and issues refund if event is cancelled
     */
    function burnTicket(uint256 tokenId) external nonReentrant {
        require(
            ownerOf(tokenId) == msg.sender ||
                isApprovedForAll(ownerOf(tokenId), msg.sender),
            "Not token owner or approved"
        );
        uint256 eventId = ticketToEvent[tokenId];
        Event storage eventDetails = events[eventId];

        if (eventDetails.eventId == 0) revert EventNotFound();

        // Only allow burning if event is cancelled or user initiated
        bool isCancelled = eventDetails.status == EventStatus.Cancelled;
        require(
            isCancelled || msg.sender == ownerOf(tokenId),
            "Cannot burn ticket"
        );

        // Process refund if event was cancelled
        if (isCancelled) {
            (bool sent, ) = payable(ownerOf(tokenId)).call{
                value: eventDetails.ticketPrice
            }("");
            if (!sent) revert RefundFailed();
            emit RefundIssued(
                ownerOf(tokenId),
                eventId,
                eventDetails.ticketPrice
            );
        }

        // Burn the ticket
        _burn(tokenId);
        eventDetails.ticketsSold--;
        emit TicketBurned(tokenId, eventId);
    }

    /**
     * @dev Completes an event
     */
    function completeEvent(uint256 eventId) external {
        Event storage eventDetails = events[eventId];
        if (eventDetails.eventId == 0) revert EventNotFound();
        if (msg.sender != eventDetails.organizer && msg.sender != owner())
            revert UnauthorizedAccess();
        if (eventDetails.status != EventStatus.Active)
            revert EventNotActive(eventId);
        if (block.timestamp < eventDetails.endTime)
            revert("Event not yet ended");

        eventDetails.status = EventStatus.Completed;
        emit EventCompleted(eventId);
    }

    // View functions
    function getEventDetails(
        uint256 eventId
    ) external view returns (Event memory) {
        Event memory eventDetails = events[eventId];
        if (eventDetails.eventId == 0) revert EventNotFound();
        return eventDetails;
    }

    function getTicketsByUser(
        bytes32 hash1
    ) external view returns (uint256[] memory) {
        if (hash1 == bytes32(0)) revert InvalidHash();
        return userTickets[hash1];
    }

    function getUserEvents(
        bytes32 hash1
    ) external view returns (uint256[] memory) {
        if (hash1 == bytes32(0)) revert InvalidHash();
        return userEvents[hash1];
    }

    function setVerifier(address _verifier) external onlyOwner {
        verifier = IVerifier(_verifier);
    }

    function checkInTicket(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[3] calldata input
    ) external nonReentrant returns (bool) {
        bytes32 hash1 = bytes32(input[0]);
        bytes32 hash2 = bytes32(input[1]);
        uint256 eventId = input[2];

        if (isTicketUsed[hash2]) revert("Ticket already checked in");
        if (!eventTickets[eventId][hash1]) revert("Ticket not purchased");

        require(verifier.verifyProof(a, b, c, input), "Invalid ZK Proof");

        isTicketUsed[hash2] = true;
        emit TicketBurned(0, eventId); // Emit dummy tokenId 0 for legacy frontend graph
        return true;
    }

    // Override transfer functions to make tickets non-transferable
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) {
            revert("Tickets are non-transferable");
        }
        return super._update(to, tokenId, auth);
    }
}
