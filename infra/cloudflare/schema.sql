-- TonTation Cloudflare D1 Database Schema
-- Version 1.0

-- Users table: stores wallet addresses and metadata
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_bets_placed INTEGER DEFAULT 0,
  total_amount_wagered REAL DEFAULT 0,
  total_amount_won REAL DEFAULT 0,
  win_count INTEGER DEFAULT 0,
  loss_count INTEGER DEFAULT 0,
  tie_count INTEGER DEFAULT 0
);

-- Rounds table: stores round metadata and results
CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN, LOCKED, SETTLING, CLOSED, VOIDED
  p0 REAL NOT NULL, -- Opening price
  p1 REAL, -- Settlement price (null until settled)
  delta REAL, -- Price delta (null until settled)
  winner TEXT, -- LONG, SHORT, or TIE (null until settled)
  long_pool REAL DEFAULT 0,
  short_pool REAL DEFAULT 0,
  total_bets REAL DEFAULT 0,
  protocol_fee REAL DEFAULT 0,
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  lock_time DATETIME,
  settle_time DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bets table: stores individual bet records
CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY, -- Format: {roundId}-{walletAddress}-{timestamp}
  round_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  wallet_address TEXT NOT NULL,
  side TEXT NOT NULL, -- LONG or SHORT
  amount REAL NOT NULL,
  payout REAL, -- null until round is settled
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, ACCEPTED, REJECTED, SETTLED, REFUNDED
  rejection_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (round_id) REFERENCES rounds(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Ledger table: canonical transaction history for each user
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  wallet_address TEXT NOT NULL,
  round_id INTEGER NOT NULL,
  bet_id TEXT,
  transaction_type TEXT NOT NULL, -- BET_PLACED, BET_ACCEPTED, BET_REJECTED, PAYOUT, REFUND
  amount REAL NOT NULL,
  balance_after REAL, -- running balance
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (round_id) REFERENCES rounds(id),
  FOREIGN KEY (bet_id) REFERENCES bets(id)
);

-- Oracle observations table: for audit and replay verification
CREATE TABLE IF NOT EXISTS oracle_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  source TEXT NOT NULL, -- binance, okx, coingecko, etc.
  price REAL NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (round_id) REFERENCES rounds(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_bets_round ON bets(round_id);
CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_wallet ON bets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_round ON ledger(round_id);
CREATE INDEX IF NOT EXISTS idx_oracle_round ON oracle_observations(round_id);
