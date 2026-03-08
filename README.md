# 🎫 ZeroPass - Zero-Knowledge Event Ticketing

ZeroPass is a completely decentralized, privacy-first Web3 ticketing platform built for the Flow EVM ecosystem. It leverages **Zero-Knowledge Proofs (zk-SNARKs)** and biometric identifiers (like an Aadhar Card Number) to guarantee that a user holds a valid, purchased ticket without ever forcing them to reveal their personal identity, wallet address, or purchase history to the event organizer.

---

## ✨ Core Features

*   **🤫 Total Anonymity (`Circom` & `snarkjs`):** Attendees derive a cryptographic `hash` locally in their browser. They purchase tickets using this hash, and generate ZK-proofs to enter events. Organizers mathematically cryptovariable verify the ticket without knowing who they just scanned.
*   **💰 Loyalty Points System:** ZeroPass features an on-chain automated Loyalty program. Every successful ZK check-in automatically awards an attendee exactly 100 points, which they can instantly redeem to mint any future event ticket completely for free.
*   **🎟️ Sybil & Scalping Resistance:** Built-in safeguards stop bad actors from checking in the same QR code twice, claiming someone else's ticket, or faking proofs.
*   **⚡ Flow EVM Powered:** The core logic, ticket non-fungible tokens, and point allocations are managed flawlessly in Solidity, deployed specifically and highly optimized to leverage Flow EVM's speed and extremely low gas costs.

## 🛠️ Tech Stack

*   **Frontend Framework:** Next.js (App Router)
*   **Cryptography:** Circom, Poseidon Hash, Groth16 zk-SNARKs (`snarkjs`)
*   **Blockchain & Smart Contracts:** Solidity, Flow Testnet, `wagmi`, `viem`
*   **Styling:** Pure Vanilla CSS with fully responsive, custom "Web3 Blocky Neon" aesthetic designs.

---

## 🚀 Project Submission Details

### 🔗 Live Deployment
https://zeropass-seven.vercel.app/

### 📜 Smart Contract Addresses
*   **ZeroPass Logic Contract:** `0x6b2901391D196143C1b5BB970dD1cCCEd3BdeFb3` (Flow Testnet)
*   **Plonk Verifier:** `0x6AB133d823C411Df632012a8C97bc98737917398` (Flow Testnet)

### 🧰 How to Run Locally
1.  **Install dependencies:** `npm install`
2.  **Start development server:** `npm run dev`
3.  **Browse the App:** Visit `http://localhost:3000` to interact with the frontend ticketing and dashboard features.

---

## 🧑‍💻 Architecture Flow
<img width="3157" height="2500" alt="image" src="https://github.com/user-attachments/assets/f4a38efb-72ba-437f-a570-35b05afed5c4" />

### 1. The Organizer
Organizers connect their Web3 wallets to natively deploy new hackathons/events directly to the blockchain. They set prices (in FLOW), limits, and locations via a fluid frontend.

### 2. The Attendee (Buying)
Attendees enter a real-world identifier (like an Aadhar Card Number). The browser hashes this `secretId`, creates an anonymous `hash1` string, and uses `wagmi` to purchase a ticket natively mapped to that hidden hash.

### 3. The Check-in (Zero-Knowledge)
On event day, the attendee types their secret number into their mobile browser. The browser locally compiles a `Groth16` proof proving they possess the secret mathematical preimage to the event's ticket pool. A beautifully branded dynamic QR code is assembled.

### 4. The Scan
The Event Organizer scans the QR proof with a camera. The ZeroPass smart contract executes the verification. By confirming valid `publicSignals`, the door opens. The user receives 100 on-chain Loyalty points. At absolutely no point during this pipeline does the organizer ever learn the attendee's true identity or wallet.
