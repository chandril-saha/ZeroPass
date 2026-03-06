pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template Ticket() {
    signal input secret;
    signal input eventId;
    
    signal output hash1;
    signal output hash2;

    component poseidon1 = Poseidon(1);
    poseidon1.inputs[0] <== secret;
    hash1 <== poseidon1.out;

    component poseidon2 = Poseidon(2);
    poseidon2.inputs[0] <== secret;
    poseidon2.inputs[1] <== eventId;
    hash2 <== poseidon2.out;
}

component main {public [eventId]} = Ticket();
