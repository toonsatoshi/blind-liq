import "@stdlib/deploy";

message PlaceBet {
    roundId: Int as uint32;
    side: Bool; // true for Long, false for Short
    amount: Int as coins;
}

message SettleRound {
    roundId: Int as uint32;
    p0: Int as uint64;
    p1: Int as uint64;
}

contract TonTation with Deployable {
    owner: Address;
    roundId: Int as uint32;
    p0: Int as uint64;
    
    init(owner: Address) {
        self.owner = owner;
        self.roundId = 0;
        self.p0 = 0;
    }

    receive(msg: PlaceBet) {
        // Logic for placing bets
        // Ensure round is OPEN
    }

    receive(msg: SettleRound) {
        // Logic for settling rounds
        // Verify sender is authorized oracle/backend
        // Calculate delta and distribute payouts
    }

    get fun currentRound(): Int {
        return self.roundId;
    }
}
