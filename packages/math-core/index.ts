/**
 * Math Core Package
 * 
 * Provides core mathematical functions for TonTation protocol:
 * - Payout calculations
 * - Threshold validation
 * - Zero-sum verification
 */

export interface PayoutResult {
  winner: 'LONG' | 'SHORT' | 'TIE';
  longPayouts: Map<string, bigint>;
  shortPayouts: Map<string, bigint>;
  totalDistributed: bigint;
  protocolFee: bigint;
}

export interface ProtocolConfig {
  leverage: number; // e.g., 150 for 150x
  protocolFeeRate: number; // e.g., 0.0001 for 0.01%
}

/**
 * Calculate the liquidation threshold based on leverage
 * Threshold = 1 / leverage
 * For 150x: threshold = 1/150 ≈ 0.006667 (0.667%)
 */
export function calculateThreshold(leverage: number): number {
  return 1 / leverage;
}

/**
 * Calculate price delta
 * delta = (p1 - p0) / p0
 */
export function calculateDelta(p0: number, p1: number): number {
  if (p0 <= 0) {
    throw new Error('Opening price must be positive');
  }
  return (p1 - p0) / p0;
}

/**
 * Determine round winner based on delta and threshold
 */
export function determineWinner(
  delta: number,
  threshold: number
): 'LONG' | 'SHORT' | 'TIE' {
  if (delta > threshold) {
    return 'LONG';
  } else if (delta < -threshold) {
    return 'SHORT';
  } else {
    return 'TIE';
  }
}

/**
 * Calculate individual payout for a winning bet
 * payout = bet_amount * (total_pool / winning_pool) * (1 - protocol_fee_rate)
 */
export function calculateIndividualPayout(
  betAmount: bigint,
  totalPool: bigint,
  winningPool: bigint,
  protocolFeeRate: number
): bigint {
  if (winningPool === 0n) {
    throw new Error('Winning pool cannot be zero');
  }

  // Calculate multiplier: total_pool / winning_pool
  // Using fixed-point arithmetic to maintain precision
  const multiplier = (totalPool * 1000000n) / winningPool;

  // Apply multiplier and fee
  const grossPayout = (betAmount * multiplier) / 1000000n;
  const fee = (grossPayout * BigInt(Math.floor(protocolFeeRate * 1000000))) / 1000000n;
  const netPayout = grossPayout - fee;

  return netPayout;
}

/**
 * Calculate refund for a tie round
 * refund = bet_amount * (1 - protocol_fee_rate)
 */
export function calculateRefund(
  betAmount: bigint,
  protocolFeeRate: number
): bigint {
  const fee = (betAmount * BigInt(Math.floor(protocolFeeRate * 1000000))) / 1000000n;
  return betAmount - fee;
}

/**
 * Verify zero-sum property: total payouts should equal total pool minus protocol fees
 */
export function verifyZeroSum(
  longBets: Map<string, bigint>,
  shortBets: Map<string, bigint>,
  longPayouts: Map<string, bigint>,
  shortPayouts: Map<string, bigint>,
  protocolFeeRate: number
): boolean {
  // Calculate total bets
  const totalLongBets = Array.from(longBets.values()).reduce((a, b) => a + b, 0n);
  const totalShortBets = Array.from(shortBets.values()).reduce((a, b) => a + b, 0n);
  const totalBets = totalLongBets + totalShortBets;

  // Calculate total payouts
  const totalLongPayouts = Array.from(longPayouts.values()).reduce((a, b) => a + b, 0n);
  const totalShortPayouts = Array.from(shortPayouts.values()).reduce((a, b) => a + b, 0n);
  const totalPayouts = totalLongPayouts + totalShortPayouts;

  // Calculate expected payouts (total bets minus protocol fees)
  const expectedPayouts = (totalBets * BigInt(Math.floor((1 - protocolFeeRate) * 1000000))) / 1000000n;

  // Verify zero-sum: total payouts should equal expected payouts (within rounding error)
  const difference = totalPayouts > expectedPayouts
    ? totalPayouts - expectedPayouts
    : expectedPayouts - totalPayouts;

  // Allow for small rounding errors (1 satoshi per bet)
  const maxRoundingError = BigInt(Array.from(longBets.keys()).length + Array.from(shortBets.keys()).length);
  return difference <= maxRoundingError;
}

/**
 * Calculate payouts for all participants in a round
 */
export function calculatePayouts(
  longBets: Map<string, bigint>,
  shortBets: Map<string, bigint>,
  winner: 'LONG' | 'SHORT' | 'TIE',
  protocolFeeRate: number
): PayoutResult {
  const totalLongBets = Array.from(longBets.values()).reduce((a, b) => a + b, 0n);
  const totalShortBets = Array.from(shortBets.values()).reduce((a, b) => a + b, 0n);
  const totalPool = totalLongBets + totalShortBets;

  const longPayouts: Map<string, bigint> = new Map();
  const shortPayouts: Map<string, bigint> = new Map();
  let totalDistributed = 0n;
  let protocolFee = 0n;

  if (winner === 'TIE') {
    // Refund all bets minus protocol fee
    for (const [bettorId, betAmount] of longBets.entries()) {
      const refund = calculateRefund(betAmount, protocolFeeRate);
      longPayouts.set(bettorId, refund);
      totalDistributed += refund;
    }

    for (const [bettorId, betAmount] of shortBets.entries()) {
      const refund = calculateRefund(betAmount, protocolFeeRate);
      shortPayouts.set(bettorId, refund);
      totalDistributed += refund;
    }

    protocolFee = totalPool - totalDistributed;
  } else if (winner === 'LONG') {
    // Long wins: payout from short pool
    for (const [bettorId, betAmount] of longBets.entries()) {
      const payout = calculateIndividualPayout(
        betAmount,
        totalPool,
        totalLongBets,
        protocolFeeRate
      );
      longPayouts.set(bettorId, payout);
      totalDistributed += payout;
    }

    protocolFee = totalPool - totalDistributed;
  } else {
    // Short wins: payout from long pool
    for (const [bettorId, betAmount] of shortBets.entries()) {
      const payout = calculateIndividualPayout(
        betAmount,
        totalPool,
        totalShortBets,
        protocolFeeRate
      );
      shortPayouts.set(bettorId, payout);
      totalDistributed += payout;
    }

    protocolFee = totalPool - totalDistributed;
  }

  return {
    winner,
    longPayouts,
    shortPayouts,
    totalDistributed,
    protocolFee,
  };
}

/**
 * Validate payout consistency
 */
export function validatePayouts(result: PayoutResult): boolean {
  // Check that all payouts are non-negative
  for (const payout of result.longPayouts.values()) {
    if (payout < 0n) return false;
  }

  for (const payout of result.shortPayouts.values()) {
    if (payout < 0n) return false;
  }

  // Check that protocol fee is non-negative
  if (result.protocolFee < 0n) return false;

  return true;
}
