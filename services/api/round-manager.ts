/**
 * RoundManager Durable Object
 * 
 * Ensures rounds continue indefinitely every 60 seconds without stopping.
 * Uses Cloudflare Durable Objects for persistent, single-threaded state management.
 */

export interface RoundState {
  id: number;
  status: 'OPEN' | 'LOCKED' | 'SETTLING' | 'CLOSED' | 'VOIDED';
  p0: number | null;
  p1: number | null;
  startTime: number;
  lockTime: number | null;
  settleTime: number | null;
  longPool: number;
  shortPool: number;
  totalBets: number;
  winner: 'LONG' | 'SHORT' | 'TIE' | null;
  protocolFee: number;
}

export class RoundManager {
  private state: any;
  private env: any;
  private db: any;
  private currentRound: RoundState;
  private roundDuration: number = 60000; // 60 seconds
  private lockTime: number = 45000; // Lock at 45 seconds
  private alarmScheduled: boolean = false;

  constructor(state: any, env: any) {
    this.state = state;
    this.env = env;
    this.db = env.DB;

    // Initialize state
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('currentRound');
      if (stored) {
        this.currentRound = stored;
      } else {
        this.currentRound = this.initializeRound(1);
        await this.state.storage.put('currentRound', this.currentRound);
      }
    });
  }

  /**
   * Initialize a new round
   */
  private initializeRound(roundId: number): RoundState {
    return {
      id: roundId,
      status: 'CLOSED',
      p0: null,
      p1: null,
      startTime: Date.now(),
      lockTime: null,
      settleTime: null,
      longPool: 0,
      shortPool: 0,
      totalBets: 0,
      winner: null,
      protocolFee: 0,
    };
  }

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/state' && request.method === 'GET') {
        return this.getState();
      }

      if (path === '/place-bet' && request.method === 'POST') {
        const body = await request.json();
        return this.placeBet(body);
      }

      if (path === '/start-round' && request.method === 'POST') {
        return this.startRound();
      }

      if (path === '/settle-round' && request.method === 'POST') {
        return this.settleRound();
      }

      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    } catch (error) {
      console.error('RoundManager error:', error);
      return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
    }
  }

  /**
   * Alarm handler - called every 60 seconds to advance rounds
   */
  async alarm(): Promise<void> {
    try {
      const now = Date.now();

      // Check if we need to lock the round
      if (
        this.currentRound.status === 'OPEN' &&
        now - this.currentRound.startTime >= this.lockTime
      ) {
        this.currentRound.status = 'LOCKED';
        this.currentRound.lockTime = now;
        console.log(`[Round ${this.currentRound.id}] LOCKED`);
        await this.state.storage.put('currentRound', this.currentRound);
      }

      // Check if we need to settle the round
      if (
        this.currentRound.status === 'LOCKED' &&
        now - this.currentRound.startTime >= this.roundDuration
      ) {
        await this.settleCurrentRound();
        await this.startNewRound();
      }

      // Reschedule alarm for next check
      this.state.storage.setAlarm(Date.now() + 1000); // Check every second
    } catch (error) {
      console.error('Alarm error:', error);
      this.state.storage.setAlarm(Date.now() + 5000); // Retry in 5 seconds
    }
  }

  /**
   * Start a new round
   */
  private async startNewRound(): Promise<void> {
    try {
      // Get opening price from Oracle API
      const price = await this.getOraclePrice();

      if (!price) {
        console.error('Failed to get oracle price, retrying...');
        this.state.storage.setAlarm(Date.now() + 5000);
        return;
      }

      const newRound = this.initializeRound(this.currentRound.id + 1);
      newRound.status = 'OPEN';
      newRound.p0 = price;
      newRound.startTime = Date.now();

      this.currentRound = newRound;
      await this.state.storage.put('currentRound', this.currentRound);

      // Insert round into database
      await this.db
        .prepare(
          `INSERT INTO rounds (id, status, p0, start_time) 
           VALUES (?, 'OPEN', ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO NOTHING`
        )
        .bind(newRound.id, price)
        .run();

      console.log(`[Round ${newRound.id}] OPEN at price $${price}`);

      // Schedule next alarm
      this.state.storage.setAlarm(Date.now() + 1000);
    } catch (error) {
      console.error('Error starting new round:', error);
      this.state.storage.setAlarm(Date.now() + 5000);
    }
  }

  /**
   * Settle the current round
   */
  private async settleCurrentRound(): Promise<void> {
    try {
      if (this.currentRound.status !== 'LOCKED') {
        return;
      }

      this.currentRound.status = 'SETTLING';

      // Get settlement price
      const settlementPrice = await this.getOraclePrice();

      if (!settlementPrice) {
        console.warn(`[Round ${this.currentRound.id}] Oracle failed, voiding round`);
        this.currentRound.status = 'VOIDED';
        this.currentRound.settleTime = Date.now();
        await this.state.storage.put('currentRound', this.currentRound);

        // Update database
        await this.db
          .prepare(`UPDATE rounds SET status = 'VOIDED', settle_time = CURRENT_TIMESTAMP WHERE id = ?`)
          .bind(this.currentRound.id)
          .run();

        return;
      }

      this.currentRound.p1 = settlementPrice;

      // Calculate delta
      const delta = (settlementPrice - this.currentRound.p0!) / this.currentRound.p0!;
      const threshold = 1 / 150; // 0.667% for 150x leverage

      // Determine winner
      let winner: 'LONG' | 'SHORT' | 'TIE' = 'TIE';
      if (delta > threshold) {
        winner = 'LONG';
      } else if (delta < -threshold) {
        winner = 'SHORT';
      }

      this.currentRound.winner = winner;
      this.currentRound.status = 'CLOSED';
      this.currentRound.settleTime = Date.now();

      // Calculate protocol fee (0.01%)
      const totalPool = this.currentRound.longPool + this.currentRound.shortPool;
      this.currentRound.protocolFee = totalPool * 0.0001;

      await this.state.storage.put('currentRound', this.currentRound);

      // Update database
      await this.db
        .prepare(
          `UPDATE rounds 
           SET status = 'CLOSED', p1 = ?, delta = ?, winner = ?, protocol_fee = ?, settle_time = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(settlementPrice, delta, winner, this.currentRound.protocolFee, this.currentRound.id)
        .run();

      console.log(
        `[Round ${this.currentRound.id}] CLOSED - Winner: ${winner}, Delta: ${(delta * 100).toFixed(3)}%`
      );
    } catch (error) {
      console.error('Error settling round:', error);
      this.currentRound.status = 'VOIDED';
    }
  }

  /**
   * Place a bet on the current round
   */
  private async placeBet(body: any): Promise<Response> {
    try {
      const { wallet_address, side, amount } = body;

      if (this.currentRound.status !== 'OPEN') {
        return new Response(
          JSON.stringify({ error: 'Round is not open for betting' }),
          { status: 400 }
        );
      }

      if (amount <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid bet amount' }), { status: 400 });
      }

      // Update pools
      if (side === 'LONG') {
        this.currentRound.longPool += amount;
      } else if (side === 'SHORT') {
        this.currentRound.shortPool += amount;
      } else {
        return new Response(JSON.stringify({ error: 'Invalid side' }), { status: 400 });
      }

      this.currentRound.totalBets += amount;
      await this.state.storage.put('currentRound', this.currentRound);

      const betId = `${this.currentRound.id}-${wallet_address}-${Date.now()}`;

      return new Response(
        JSON.stringify({
          bet_id: betId,
          round_id: this.currentRound.id,
          status: 'ACCEPTED',
        }),
        { status: 200 }
      );
    } catch (error) {
      console.error('Error placing bet:', error);
      return new Response(JSON.stringify({ error: 'Failed to place bet' }), { status: 500 });
    }
  }

  /**
   * Get current round state
   */
  private async getState(): Promise<Response> {
    return new Response(JSON.stringify(this.currentRound), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Manually start a round (for testing)
   */
  private async startRound(): Promise<Response> {
    await this.startNewRound();
    return new Response(JSON.stringify(this.currentRound), { status: 200 });
  }

  /**
   * Manually settle a round (for testing)
   */
  private async settleRound(): Promise<Response> {
    await this.settleCurrentRound();
    return new Response(JSON.stringify(this.currentRound), { status: 200 });
  }

  /**
   * Fetch oracle price from external API
   */
  private async getOraclePrice(): Promise<number | null> {
    try {
      // In production, this would call your Oracle Aggregator service
      // For now, we'll use CoinGecko as a fallback
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd'
      );
      const data = await response.json();
      return data?.['the-open-network']?.usd || null;
    } catch (error) {
      console.error('Oracle fetch error:', error);
      return null;
    }
  }
}

export default RoundManager;
