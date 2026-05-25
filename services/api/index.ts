/**
 * TonTation Backend API Service
 * Cloudflare Worker implementation for user ledger and round data
 */

export interface ApiRequest {
  method: string;
  path: string;
  body?: any;
  headers: Record<string, string>;
}

export interface ApiResponse {
  status: number;
  body: any;
  headers?: Record<string, string>;
}

export interface UserLedgerEntry {
  id: number;
  wallet_address: string;
  round_id: number;
  bet_id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  created_at: string;
}

export interface UserProfile {
  wallet_address: string;
  created_at: string;
  total_bets_placed: number;
  total_amount_wagered: number;
  total_amount_won: number;
  win_count: number;
  loss_count: number;
  tie_count: number;
  win_rate: number;
}

export interface BetRecord {
  id: string;
  round_id: number;
  wallet_address: string;
  side: string;
  amount: number;
  payout: number | null;
  status: string;
  created_at: string;
}

export interface RoundData {
  id: number;
  status: string;
  p0: number;
  p1: number | null;
  delta: number | null;
  winner: string | null;
  long_pool: number;
  short_pool: number;
  total_bets: number;
  protocol_fee: number;
  start_time: string;
  settle_time: string | null;
}

/**
 * Main API handler for Cloudflare Workers
 */
export class TonTationAPI {
  private db: any; // Cloudflare D1 Database binding

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Route requests to appropriate handlers
   */
  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // User Ledger endpoints
      if (path.startsWith('/api/ledger/') && method === 'GET') {
        return this.getUserLedger(path.split('/')[3]);
      }

      // User Profile endpoint
      if (path.startsWith('/api/profile/') && method === 'GET') {
        return this.getUserProfile(path.split('/')[3]);
      }

      // Place bet endpoint
      if (path === '/api/bets' && method === 'POST') {
        const body = await request.json();
        return this.placeBet(body);
      }

      // Get round data endpoint
      if (path.startsWith('/api/rounds/') && method === 'GET') {
        const roundId = path.split('/')[3];
        if (roundId === 'current') {
          return this.getCurrentRound();
        }
        return this.getRoundData(parseInt(roundId));
      }

      // Get current round state from Durable Object
      if (path === '/api/round-state' && method === 'GET') {
        return this.getRoundState();
      }

      // Health check
      if (path === '/api/health' && method === 'GET') {
        return this.ok({ status: 'healthy' });
      }

      return this.notFound({ error: 'Endpoint not found' });
    } catch (error) {
      console.error('API Error:', error);
      return this.internalError({ error: 'Internal server error' });
    }
  }

  /**
   * Get user ledger (transaction history)
   */
  private async getUserLedger(walletAddress: string): Promise<Response> {
    try {
      const result = await this.db
        .prepare(
          `SELECT * FROM ledger 
           WHERE wallet_address = ? 
           ORDER BY created_at DESC 
           LIMIT 100`
        )
        .bind(walletAddress)
        .all();

      return this.ok(result.results || []);
    } catch (error) {
      console.error('Error fetching ledger:', error);
      return this.internalError({ error: 'Failed to fetch ledger' });
    }
  }

  /**
   * Get user profile with statistics
   */
  private async getUserProfile(walletAddress: string): Promise<Response> {
    try {
      const result = await this.db
        .prepare(
          `SELECT 
             wallet_address,
             created_at,
             total_bets_placed,
             total_amount_wagered,
             total_amount_won,
             win_count,
             loss_count,
             tie_count,
             ROUND(CAST(win_count AS FLOAT) / NULLIF(total_bets_placed, 0), 4) as win_rate
           FROM users 
           WHERE wallet_address = ?`
        )
        .bind(walletAddress)
        .first();

      if (!result) {
        // User doesn't exist yet, create profile
        await this.db
          .prepare(
            `INSERT INTO users (wallet_address) VALUES (?) 
             ON CONFLICT(wallet_address) DO NOTHING`
          )
          .bind(walletAddress)
          .run();

        return this.ok({
          wallet_address: walletAddress,
          created_at: new Date().toISOString(),
          total_bets_placed: 0,
          total_amount_wagered: 0,
          total_amount_won: 0,
          win_count: 0,
          loss_count: 0,
          tie_count: 0,
          win_rate: 0,
        });
      }

      return this.ok(result);
    } catch (error) {
      console.error('Error fetching profile:', error);
      return this.internalError({ error: 'Failed to fetch profile' });
    }
  }

  /**
   * Place a bet
   */
  private async placeBet(body: any): Promise<Response> {
    try {
      const { wallet_address, round_id, side, amount } = body;

      if (!wallet_address || !round_id || !side || !amount) {
        return this.badRequest({ error: 'Missing required fields' });
      }

      if (amount <= 0) {
        return this.badRequest({ error: 'Bet amount must be positive' });
      }

      // Get or create user
      await this.db
        .prepare(
          `INSERT INTO users (wallet_address) VALUES (?) 
           ON CONFLICT(wallet_address) DO NOTHING`
        )
        .bind(wallet_address)
        .run();

      // Get user ID
      const user = await this.db
        .prepare(`SELECT id FROM users WHERE wallet_address = ?`)
        .bind(wallet_address)
        .first();

      const betId = `${round_id}-${wallet_address}-${Date.now()}`;

      // Insert bet
      await this.db
        .prepare(
          `INSERT INTO bets (id, round_id, user_id, wallet_address, side, amount, status)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`
        )
        .bind(betId, round_id, user.id, wallet_address, side, amount)
        .run();

      // Update user statistics
      await this.db
        .prepare(
          `UPDATE users 
           SET total_bets_placed = total_bets_placed + 1,
               total_amount_wagered = total_amount_wagered + ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(amount, user.id)
        .run();

      // Add to ledger
      await this.db
        .prepare(
          `INSERT INTO ledger (user_id, wallet_address, round_id, bet_id, transaction_type, amount, description)
           VALUES (?, ?, ?, ?, 'BET_PLACED', ?, ?)`
        )
        .bind(user.id, wallet_address, round_id, betId, amount, `Bet ${side} ${amount} TON on round ${round_id}`)
        .run();

      return this.ok({ bet_id: betId, status: 'PENDING' });
    } catch (error) {
      console.error('Error placing bet:', error);
      return this.internalError({ error: 'Failed to place bet' });
    }
  }

  /**
   * Get round data
   */
  private async getRoundData(roundId: number): Promise<Response> {
    try {
      const result = await this.db
        .prepare(`SELECT * FROM rounds WHERE id = ?`)
        .bind(roundId)
        .first();

      if (!result) {
        return this.notFound({ error: 'Round not found' });
      }

      return this.ok(result);
    } catch (error) {
      console.error('Error fetching round:', error);
      return this.internalError({ error: 'Failed to fetch round' });
    }
  }

  /**
   * Get current round from database
   */
  private async getCurrentRound(): Promise<Response> {
    try {
      const result = await this.db
        .prepare(
          `SELECT * FROM rounds 
           WHERE status IN ('OPEN', 'LOCKED', 'SETTLING')
           ORDER BY id DESC 
           LIMIT 1`
        )
        .first();

      if (!result) {
        return this.notFound({ error: 'No active round' });
      }

      return this.ok(result);
    } catch (error) {
      console.error('Error fetching current round:', error);
      return this.internalError({ error: 'Failed to fetch current round' });
    }
  }

  /**
   * Get round state from Durable Object (real-time)
   */
  private async getRoundState(): Promise<Response> {
    // This would be called by the Durable Object
    // For now, return the database version
    return this.getCurrentRound();
  }

  /**
   * HTTP response helpers
   */
  private ok(body: any): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private badRequest(body: any): Response {
    return new Response(JSON.stringify(body), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private notFound(body: any): Response {
    return new Response(JSON.stringify(body), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private internalError(body: any): Response {
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

interface Env {
  DB: D1Database;
  CACHE?: KVNamespace;
}

/**
 * Export handler for Cloudflare Workers
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const api = new TonTationAPI(env.DB);
    return api.handleRequest(request);
  },
};

export { RoundManager } from './round-manager';
