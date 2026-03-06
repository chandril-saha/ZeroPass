// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

import "./Verifier.sol";

contract ZeroPass {
    Groth16Verifier public verifier;

    struct Event {
        address organizer;
        uint256 price;
        bool isActive;
    }

    // Mapping from event ID to Event details
    mapping(uint256 => Event) public events;

    // Mapping to store registered commitments (tickets) per event
    // Using mapping(eventId => mapping(commitment => address)) to store purchaser
    mapping(uint256 => mapping(uint256 => address)) public tickets;

    // Mapping to store spent nullifiers per event to prevent double check-ins
    // mapping(eventId => mapping(nullifier => bool))
    mapping(uint256 => mapping(uint256 => bool)) public spentNullifiers;

    event EventCreated(
        uint256 indexed eventId,
        address indexed organizer,
        uint256 price
    );
    event TicketPurchased(
        uint256 indexed eventId,
        address indexed purchaser,
        uint256 commitment
    );
    event CheckedIn(
        uint256 indexed eventId,
        address indexed user,
        uint256 nullifier
    );

    constructor(address _verifierAddress) {
        verifier = Groth16Verifier(_verifierAddress);
    }

    // --- Organizer Functions ---

    function createEvent(uint256 eventId, uint256 price) external {
        require(
            events[eventId].organizer == address(0),
            "Event ID already exists"
        );

        events[eventId] = Event({
            organizer: msg.sender,
            price: price,
            isActive: true
        });

        emit EventCreated(eventId, msg.sender, price);
    }

    // --- User Functions ---

    // User calls this after computing `commitment` off-chain
    function buyTicket(uint256 eventId, uint256 commitment) external payable {
        Event memory evt = events[eventId];
        require(evt.isActive, "Event is not active");
        require(msg.value >= evt.price, "Insufficient payment");
        require(
            tickets[eventId][commitment] == address(0),
            "Commitment already registered"
        );

        // Forward payment to the organizer
        if (msg.value > 0) {
            (bool success, ) = payable(evt.organizer).call{value: msg.value}(
                ""
            );
            require(success, "Transfer failed");
        }

        // Register the ticket commitment to the msg.sender's wallet
        tickets[eventId][commitment] = msg.sender;

        emit TicketPurchased(eventId, msg.sender, commitment);
    }

    // Check-in requires the zk-SNARK proof and the output signals (nullifier, commitment, eventId)
    // We pass eventId as well to locate the ticket
    function checkIn(
        uint256 eventId,
        uint256 nullifier,
        uint256 commitment,
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c
    ) external {
        require(events[eventId].isActive, "Event is not active");
        require(
            tickets[eventId][commitment] == msg.sender,
            "Caller is not the ticket owner"
        );
        require(
            !spentNullifiers[eventId][nullifier],
            "Ticket has already been checked in"
        );

        // Public signals for the verifier circuit are:
        // 0: nullifier
        // 1: commitment
        // 2: eventId
        uint[3] memory pubSignals = [nullifier, commitment, eventId];

        require(verifier.verifyProof(a, b, c, pubSignals), "Invalid ZK Proof");

        // Mark ticket as checked in using its nullifier
        spentNullifiers[eventId][nullifier] = true;

        emit CheckedIn(eventId, msg.sender, nullifier);
    }
}
