import "@stdlib/deploy";

// Messages for external interaction
message PlaceBet {
    queryId: Int as uint64;
    roundId: Int as uint32;
    side: Bool; // true for Long, false for Short
    amount: Int as coins;
}

message RoundOpen {
    queryId: Int as uint64;
    roundId: Int as uint32;
    p0: Int as uint64; // Price at round open
}

message RoundLock {
    queryId: Int as uint64;
    roundId: Int as uint32;
}

message RoundSettle {
    queryId: Int as uint64;
    roundId: Int as uint32;
    p1: Int as uint64; // Price at round settlement
}

message RoundRefund {
    queryId: Int as uint64;
    roundId: Int as uint32;
}

message EmergencyHalt {
    queryId: Int as uint64;
}

// Internal state of the contract
struct RoundState {
    id: Int as uint32;
    p0: Int as uint64;
    longPool: Int as coins;
    shortPool: Int as coins;
    totalBets: Int as coins;
    // Add more state variables as needed, e.g., status, start_time, etc.
}

contract TonTation with Deployable {
    owner: Address;
    currentRound: RoundState;
    liquidationThreshold: Int as uint16; // Representing 0.667% as 667 (multiplied by 100000 for precision)
    protocolFeeRate: Int as uint16; // Representing a small fee, e.g., 0.01% as 100 (multiplied by 1000000 for precision)

    init(owner: Address) {
        self.owner = owner;
        self.currentRound = RoundState{id: 0, p0: 0, longPool: 0, shortPool: 0, totalBets: 0};
        self.liquidationThreshold = 667; // 0.667% * 100000
        self.protocolFeeRate = 100; // 0.01% * 1000000
    }

    // Receive function for general messages (e.g., top-up, simple transfers)
    receive() {
        // Allow owner to top up contract balance
        if (sender() == self.owner) {
            return;
        }
        // Handle other simple transfers or reject
        nativeReserve(1000000000); // 1 TON for gas and storage
        throw(0xFF); // Reject unknown messages
    }

    // External message to open a new round (only callable by owner/authorized backend)
    receive(msg: RoundOpen) {
        require(sender() == self.owner, "Only owner can open rounds");
        require(msg.roundId == self.currentRound.id + 1, "Invalid round ID for opening");

        self.currentRound = RoundState{
            id: msg.roundId,
            p0: msg.p0,
            longPool: 0,
            shortPool: 0,
            totalBets: 0
        };
        // Log event or emit internal message for round opened
    }

    // External message to place a bet
    receive(msg: PlaceBet) {
        // Invariant: Round must be OPEN (placeholder for actual state management)
        // require(self.currentRound.status == RoundStatus.OPEN, "Round not open for betting");
        require(msg.roundId == self.currentRound.id, "Bet for wrong round");
        require(msg.amount > 0, "Bet amount must be positive");

        // Transfer bet amount to contract
        let betAmount = msg.amount;
        // This is a simplified model. In a real contract, funds would be attached to the message.
        // For Tact, `inMsg.value` would be used.

        if (msg.side) { // LONG
            self.currentRound.longPool = self.currentRound.longPool + betAmount;
        } else { // SHORT
            self.currentRound.shortPool = self.currentRound.shortPool + betAmount;
        }
        self.currentRound.totalBets = self.currentRound.totalBets + betAmount;

        // Emit internal message for bet placed
    }

    // External message to lock a round (only callable by owner/authorized backend)
    receive(msg: RoundLock) {
        require(sender() == self.owner, "Only owner can lock rounds");
        require(msg.roundId == self.currentRound.id, "Invalid round ID for locking");
        // Invariant: Round must be OPEN (placeholder for actual state management)
        // self.currentRound.status = RoundStatus.LOCKED;
        // Log event or emit internal message for round locked
    }

    // External message to settle a round (only callable by owner/authorized backend)
    receive(msg: RoundSettle) {
        require(sender() == self.owner, "Only owner can settle rounds");
        require(msg.roundId == self.currentRound.id, "Invalid round ID for settlement");
        // Invariant: Round must be LOCKED (placeholder for actual state management)

        let p0 = self.currentRound.p0;
        let p1 = msg.p1;

        // Calculate price delta: delta = (p1 - p0) / p0
        // Using 10^9 for fixed-point arithmetic to maintain precision
        let delta = (p1 - p0) * 1000000000 / p0;

        // Determine winner based on liquidation threshold
        let longWins = delta > self.liquidationThreshold;
        let shortWins = delta < -self.liquidationThreshold;
        let isTie = (delta >= -self.liquidationThreshold) && (delta <= self.liquidationThreshold);

        let totalPool = self.currentRound.longPool + self.currentRound.shortPool;
        let winningPool: Int = 0;
        let losingPool: Int = 0;

        if (longWins) {
            winningPool = self.currentRound.longPool;
            losingPool = self.currentRound.shortPool;
        } else if (shortWins) {
            winningPool = self.currentRound.shortPool;
            losingPool = self.currentRound.longPool;
        } else { // Tie
            // Refund all bets minus protocol fee
            // This logic would involve iterating through individual bets, which is complex in Tact
            // For now, we'll just set pools to 0 and assume refunds are handled off-chain or via a more complex mechanism
            self.currentRound.longPool = 0;
            self.currentRound.shortPool = 0;
            // Emit refund messages for all participants
            return;
        }

        // Calculate payout for winning bets
        // payout = bet_amount * (winning_pool + losing_pool) / winning_pool * (1 - protocol_fee_rate)
        // This requires iterating through individual bets and their amounts, which is not directly supported in this simplified contract.
        // A real implementation would involve storing individual bets or using a Merkle tree for payouts.

        // For demonstration, we'll just clear the pools and assume payouts are handled.
        self.currentRound.longPool = 0;
        self.currentRound.shortPool = 0;
        self.currentRound.totalBets = 0;

        // Emit internal messages for payouts

        // Invariant: Single-settlement invariant (ensure this round is settled only once)
        // Invariant: Atomic balance invariant (total contract balance remains consistent)
        // Invariant: Deterministic replay invariant (outcome reproducible)

        // Log event or emit internal message for round settled
    }

    // External message to refund a round (only callable by owner/authorized backend)
    receive(msg: RoundRefund) {
        require(sender() == self.owner, "Only owner can refund rounds");
        require(msg.roundId == self.currentRound.id, "Invalid round ID for refund");
        // Logic to refund all participants for a specific round
        // This would involve iterating through individual bets, similar to tie settlement.
        self.currentRound.longPool = 0;
        self.currentRound.shortPool = 0;
        self.currentRound.totalBets = 0;
        // Emit refund messages
    }

    // External message for emergency halt (only callable by owner)
    receive(msg: EmergencyHalt) {
        require(sender() == self.owner, "Only owner can halt the contract");
        // Implement emergency halt logic, e.g., disable betting, allow withdrawals
        // For now, just a placeholder.
    }

    // Getters for contract state
    get fun owner(): Address {
        return self.owner;
    }

    get fun currentRoundId(): Int {
        return self.currentRound.id;
    }

    get fun currentRoundP0(): Int {
        return self.currentRound.p0;
    }

    get fun currentLongPool(): Int {
        return self.currentRound.longPool;
    }

    get fun currentShortPool(): Int {
        return self.currentRound.shortPool;
    }

    get fun currentTotalBets(): Int {
        return self.currentRound.totalBets;
    }
}
