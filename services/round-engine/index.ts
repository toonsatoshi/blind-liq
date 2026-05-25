import { OracleAggregator, OracleConsensus } from '../oracle-aggregator/index';

export enum RoundStatus {
  OPEN = 'OPEN',
  LOCKED = 'LOCKED',
  SETTLING = 'SETTLING',
  CLOSED = 'CLOSED',
  VOIDED = 'VOIDED',
}

export interface Bet {
  id: string;
  bettor: string;
  side: 'LONG' | 'SHORT';
  amount: bigint;
  timestamp: number;
}

export interface RoundState {
  id: number;
  status: RoundStatus;
  startTime: number;
  p0?: number;
  p1?: number;
  longPool: bigint;
  shortPool: bigint;
  bets: Map<string, Bet>;
  oracleConsensus?: OracleConsensus;
  settled: boolean;
}

export interface RoundSnapshot {
  roundId: number;
  status: RoundStatus;
  p0?: number;
  p1?: number;
  longPool: string; // Serialized as string for JSON compatibility
  shortPool: string;
  timestamp: number;
  signature?: string; // For signed snapshots
}

export class RoundCoordinator {
  private currentRound: RoundState;
  private roundHistory: Map<number, RoundState> = new Map();
  private oracleAggregator: OracleAggregator;
  private roundDuration: number = 60000; // 60 seconds
  private lockTime: number = 45000; // 45 seconds (lock at 45s)
  private roundTimer?: NodeJS.Timeout;
  private symbol: string = 'BTC-USDT';

  constructor(oracleAggregator: OracleAggregator) {
    this.oracleAggregator = oracleAggregator;
    this.currentRound = this.initializeRound(1);
  }

  /**
   * Initialize a new round
   */
  private initializeRound(roundId: number): RoundState {
    return {
      id: roundId,
      status: RoundStatus.CLOSED,
      startTime: Date.now(),
      longPool: 0n,
      shortPool: 0n,
      bets: new Map(),
      settled: false,
    };
  }

  /**
   * Start a new round with opening price
   */
  async startNewRound(price?: number): Promise<RoundState> {
    // Ensure previous round is settled
    if (
      this.currentRound.status !== RoundStatus.CLOSED &&
      this.currentRound.status !== RoundStatus.VOIDED
    ) {
      throw new Error('Cannot start new round: previous round not closed');
    }

    // Get opening price from oracle if not provided
    if (!price) {
      const consensus = await this.oracleAggregator.getConsensusPrice(this.symbol);
      if (consensus.consensusType === 'VOID') {
        throw new Error('Oracle consensus failed: cannot start round');
      }
      price = consensus.price;
    }

    this.currentRound = this.initializeRound(this.currentRound.id + 1);
    this.currentRound.status = RoundStatus.OPEN;
    this.currentRound.startTime = Date.now();
    this.currentRound.p0 = price;

    console.log(
      `[Round ${this.currentRound.id}] OPEN at price ${price} (${new Date().toISOString()})`
    );

    // Schedule round transitions
    this.scheduleRoundTransitions();

    return this.currentRound;
  }

  /**
   * Schedule automatic round transitions
   */
  private scheduleRoundTransitions(): void {
    // Clear any existing timer
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
    }

    // Lock the round at 45 seconds
    this.roundTimer = setTimeout(() => {
      this.lockRound();

      // Settle the round at 60 seconds
      setTimeout(() => {
        this.settleRound();
      }, this.roundDuration - this.lockTime);
    }, this.lockTime);
  }

  /**
   * Lock the current round (no more bets allowed)
   */
  private lockRound(): void {
    if (this.currentRound.status === RoundStatus.OPEN) {
      this.currentRound.status = RoundStatus.LOCKED;
      console.log(
        `[Round ${this.currentRound.id}] LOCKED (${new Date().toISOString()})`
      );
    }
  }

  /**
   * Settle the current round with oracle price
   */
  private async settleRound(): Promise<void> {
    if (this.currentRound.status !== RoundStatus.LOCKED) {
      console.warn('Cannot settle: round is not locked');
      return;
    }

    this.currentRound.status = RoundStatus.SETTLING;

    try {
      // Get settlement price from oracle
      const consensus = await this.oracleAggregator.getConsensusPrice(this.symbol);

      if (consensus.consensusType === 'VOID') {
        console.warn(`[Round ${this.currentRound.id}] Oracle consensus failed, voiding round`);
        this.currentRound.status = RoundStatus.VOIDED;
        this.currentRound.oracleConsensus = consensus;
        // Trigger refunds for all participants
        return;
      }

      this.currentRound.p1 = consensus.price;
      this.currentRound.oracleConsensus = consensus;

      // Calculate delta and determine winner
      const delta = (consensus.price - this.currentRound.p0!) / this.currentRound.p0!;
      const threshold = 1 / 150; // 0.667% for 150x leverage

      console.log(
        `[Round ${this.currentRound.id}] SETTLING at price ${consensus.price}, delta: ${(delta * 100).toFixed(3)}%`
      );

      let winner: 'LONG' | 'SHORT' | 'TIE' = 'TIE';
      if (delta > threshold) {
        winner = 'LONG';
      } else if (delta < -threshold) {
        winner = 'SHORT';
      }

      console.log(
        `[Round ${this.currentRound.id}] Winner: ${winner}, Long Pool: ${this.currentRound.longPool}, Short Pool: ${this.currentRound.shortPool}`
      );

      // Calculate payouts (simplified - in production, iterate through individual bets)
      this.calculatePayouts(winner);

      this.currentRound.status = RoundStatus.CLOSED;
      this.currentRound.settled = true;

      // Store round in history
      this.roundHistory.set(this.currentRound.id, { ...this.currentRound });

      console.log(`[Round ${this.currentRound.id}] CLOSED (${new Date().toISOString()})`);

      // Start next round automatically
      setTimeout(() => {
        this.startNewRound();
      }, 1000); // 1 second delay before next round
    } catch (error) {
      console.error(`[Round ${this.currentRound.id}] Settlement error:`, error);
      this.currentRound.status = RoundStatus.VOIDED;
    }
  }

  /**
   * Calculate and log payouts (simplified implementation)
   */
  private calculatePayouts(winner: 'LONG' | 'SHORT' | 'TIE'): void {
    const protocolFeeRate = 0.0001; // 0.01%
    const totalPool = this.currentRound.longPool + this.currentRound.shortPool;

    if (winner === 'TIE') {
      // Refund all bets minus protocol fee
      const refundAmount = totalPool * (1 - protocolFeeRate);
      console.log(`Refunding ${refundAmount} to all participants (tie)`);
    } else if (winner === 'LONG') {
      // Long wins: payout = bet * (total_pool / long_pool) * (1 - fee)
      const multiplier = Number(totalPool) / Number(this.currentRound.longPool);
      console.log(`Long winners get ${multiplier}x payout (minus ${protocolFeeRate * 100}% fee)`);
    } else {
      // Short wins: payout = bet * (total_pool / short_pool) * (1 - fee)
      const multiplier = Number(totalPool) / Number(this.currentRound.shortPool);
      console.log(`Short winners get ${multiplier}x payout (minus ${protocolFeeRate * 100}% fee)`);
    }
  }

  /**
   * Place a bet on the current round
   */
  placeBet(bettor: string, side: 'LONG' | 'SHORT', amount: bigint): Bet {
    if (this.currentRound.status !== RoundStatus.OPEN) {
      throw new Error('Round is not open for betting');
    }

    if (amount <= 0n) {
      throw new Error('Bet amount must be positive');
    }

    const bet: Bet = {
      id: `${this.currentRound.id}-${bettor}-${Date.now()}`,
      bettor,
      side,
      amount,
      timestamp: Date.now(),
    };

    // Add to pool
    if (side === 'LONG') {
      this.currentRound.longPool += amount;
    } else {
      this.currentRound.shortPool += amount;
    }

    // Store bet
    this.currentRound.bets.set(bet.id, bet);

    console.log(
      `[Round ${this.currentRound.id}] Bet placed: ${bettor} ${side} ${amount} TON`
    );

    return bet;
  }

  /**
   * Get current round state
   */
  getState(): RoundState {
    return { ...this.currentRound };
  }

  /**
   * Get signed round snapshot for public distribution
   */
  getSnapshot(): RoundSnapshot {
    return {
      roundId: this.currentRound.id,
      status: this.currentRound.status,
      p0: this.currentRound.p0,
      p1: this.currentRound.p1,
      longPool: this.currentRound.longPool.toString(),
      shortPool: this.currentRound.shortPool.toString(),
      timestamp: Date.now(),
    };
  }

  /**
   * Get round history
   */
  getHistory(limit: number = 10): RoundState[] {
    const rounds = Array.from(this.roundHistory.values());
    return rounds.slice(-limit);
  }

  /**
   * Get specific round by ID
   */
  getRound(roundId: number): RoundState | undefined {
    if (roundId === this.currentRound.id) {
      return this.getState();
    }
    return this.roundHistory.get(roundId);
  }

  /**
   * Stop the round engine
   */
  stop(): void {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
    }
    console.log('Round engine stopped');
  }
}

/**
 * Factory function to create a default RoundCoordinator instance
 */
export function createDefaultRoundCoordinator(
  oracleAggregator: OracleAggregator
): RoundCoordinator {
  return new RoundCoordinator(oracleAggregator);
}
