# Cloudflare Durable Objects Integration Guide

## Overview

The **RoundManager** is a Cloudflare Durable Object that ensures TonTation rounds continue indefinitely every 60 seconds without stopping, even when no users are online.

## How It Works

### Single-Threaded Execution
Unlike standard Workers that are stateless and can be spawned/destroyed at will, a Durable Object is:
- **Single-threaded**: Only one instance runs at a time, preventing race conditions
- **Persistent**: Maintains state in storage that survives across requests
- **Scheduled**: Uses Alarms to wake itself up automatically

### Round Lifecycle
1. **T=0s**: Round starts (`OPEN`), opening price fetched from Oracle
2. **T=45s**: Betting closes (`LOCKED`)
3. **T=60s**: Settlement price fetched, winner determined, payouts calculated (`CLOSED`)
4. **T=61s**: New round begins automatically

## Architecture

```
┌─────────────────────────────────────────┐
│   Cloudflare Workers (Stateless)        │
│   - API endpoints                       │
│   - Request routing                     │
└────────────┬────────────────────────────┘
             │
             ├─────────────────────────────┐
             │                             │
             ▼                             ▼
┌──────────────────────┐    ┌──────────────────────┐
│  RoundManager DO     │    │   D1 Database        │
│  (Persistent State)  │◄──►│   (Permanent Storage)│
│  - Current round     │    │   - Round history    │
│  - Pool balances     │    │   - User ledger      │
│  - Alarms            │    │   - Bets             │
└──────────────────────┘    └──────────────────────┘
```

## Deployment

### 1. Create Durable Object Namespace

```bash
wrangler d1 create tontation-db
```

### 2. Update wrangler.toml

The `wrangler.toml` already includes:

```toml
[[durable_objects.bindings]]
name = "ROUND_MANAGER"
class_name = "RoundManager"
script_name = "tontation-api"

[durable_objects]
migrations = [
  { tag = "v1", new_classes = ["RoundManager"] }
]
```

### 3. Deploy

```bash
wrangler deploy --env production
```

## API Endpoints

### Get Round State (Real-Time)
```bash
GET /api/round-state
```

Returns the current round state from the Durable Object:
```json
{
  "id": 42,
  "status": "OPEN",
  "p0": 2.45,
  "p1": null,
  "startTime": 1700000000000,
  "lockTime": null,
  "settleTime": null,
  "longPool": 150.5,
  "shortPool": 200.3,
  "totalBets": 350.8,
  "winner": null,
  "protocolFee": 0
}
```

### Place Bet (Via Durable Object)
```bash
POST /api/round-manager/place-bet
Content-Type: application/json

{
  "wallet_address": "0QBJ8ihO3VrpqT48fK4d9dGaI4la6_OQj72p69wV-Nj0r4_m",
  "side": "LONG",
  "amount": 5.0
}
```

## Alarms and Scheduling

The RoundManager uses Cloudflare Alarms to schedule automatic round transitions:

```typescript
// Set alarm for next check (every 1 second)
this.state.storage.setAlarm(Date.now() + 1000);

// The alarm() method is called automatically
async alarm(): Promise<void> {
  // Check if we need to lock/settle the round
  // Reschedule next alarm
}
```

### Alarm Behavior
- **Guaranteed execution**: Alarms persist even if the Worker crashes
- **Retry logic**: Failed alarms are retried automatically
- **Precision**: Alarms are accurate to within a few seconds

## State Management

### Durable Object Storage
```typescript
// Store state
await this.state.storage.put('currentRound', roundData);

// Retrieve state
const round = await this.state.storage.get('currentRound');

// Delete state
await this.state.storage.delete('currentRound');
```

### Concurrency Control
```typescript
// Prevent concurrent access
await this.state.blockConcurrencyWhile(async () => {
  // Only one request can execute this block at a time
  const stored = await this.state.storage.get('currentRound');
});
```

## Oracle Integration

The RoundManager fetches prices from the Oracle Aggregator service:

```typescript
private async getOraclePrice(): Promise<number | null> {
  // Calls your Oracle Aggregator API
  // Falls back to CoinGecko if needed
}
```

To integrate your custom Oracle Aggregator:

1. Deploy the Oracle Aggregator to a separate Worker
2. Update the `getOraclePrice()` method to call your API:

```typescript
private async getOraclePrice(): Promise<number | null> {
  try {
    const response = await fetch('https://oracle.tontation.io/api/price');
    const data = await response.json();
    return data.price;
  } catch (error) {
    console.error('Oracle error:', error);
    return null;
  }
}
```

## Monitoring

### View Logs
```bash
wrangler tail --env production
```

### Check Durable Object Status
```bash
wrangler durable-objects list
```

### Debug Alarms
```bash
# View alarm history
wrangler durable-objects inspect <id>
```

## Cost Considerations

- **Durable Objects**: $0.15 per 1M requests (includes storage)
- **Storage**: Included in Durable Objects pricing
- **Alarms**: Included in Durable Objects pricing

For production with high volume, consider:
- Upgrading to a paid Cloudflare plan
- Optimizing alarm frequency
- Implementing caching strategies

## Troubleshooting

### Rounds Not Advancing
1. Check logs: `wrangler tail`
2. Verify alarm is scheduled: `wrangler durable-objects inspect <id>`
3. Check Oracle API is responding

### State Not Persisting
1. Verify D1 database is bound correctly
2. Check storage quota hasn't been exceeded
3. Review error logs for storage failures

### High Latency
1. Reduce alarm frequency if not needed
2. Implement caching for frequently accessed data
3. Optimize database queries

## Next Steps

1. **Testing**: Deploy to staging and verify rounds advance correctly
2. **Monitoring**: Set up alerts for round settlement failures
3. **Optimization**: Profile and optimize the alarm frequency
4. **Integration**: Connect the frontend to the `/api/round-state` endpoint
