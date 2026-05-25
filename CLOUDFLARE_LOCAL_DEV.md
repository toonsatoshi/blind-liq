# Local Development Setup for Cloudflare Workers

This guide helps you run the entire TonTation API locally using Wrangler for testing before deployment.

## Prerequisites

1. **Node.js 18+**: Download from [nodejs.org](https://nodejs.org/)
2. **Cloudflare Account**: Free account at [cloudflare.com](https://cloudflare.com)
3. **Wrangler CLI**: Install globally

```bash
npm install -g wrangler@latest
```

## Quick Start

### 1. Install Dependencies

```bash
cd TonTation
npm install
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

This opens a browser window to authorize Wrangler with your Cloudflare account.

### 3. Create Local D1 Database

```bash
wrangler d1 create tontation-db-local
```

Copy the `database_id` from the output.

### 4. Update wrangler.toml

Edit `infra/cloudflare/wrangler.toml` and update the development section:

```toml
[env.development]
vars = { ENVIRONMENT = "development", API_BASE_URL = "http://localhost:8787", CONTRACT_ADDRESS = "kQBJ8ihO3VrpqT48fK4d9dGaI4la6_OQj72p69wV-Nj0r4_m" }

[[env.development.d1_databases]]
binding = "DB"
database_name = "tontation-db-local"
database_id = "YOUR_LOCAL_DATABASE_ID"  # Paste the ID from step 3
```

### 5. Initialize Database Schema

```bash
wrangler d1 execute tontation-db-local --file=./infra/cloudflare/schema.sql --env development
```

This creates all the tables and indexes.

### 6. Start Local Development Server

```bash
cd services/api
wrangler dev --env development
```

The API will be available at `http://localhost:8787`

### 7. Test the API

In a new terminal, test the endpoints:

```bash
# Health check
curl http://localhost:8787/api/health

# Create a user profile
curl http://localhost:8787/api/profile/0QBJ8ihO3VrpqT48fK4d9dGaI4la6_OQj72p69wV-Nj0r4_m

# Place a bet
curl -X POST http://localhost:8787/api/bets \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "0QBJ8ihO3VrpqT48fK4d9dGaI4la6_OQj72p69wV-Nj0r4_m",
    "round_id": 1,
    "side": "LONG",
    "amount": 1.5
  }'
```

## Useful Commands

### View Local Database

```bash
wrangler d1 execute tontation-db-local --command "SELECT * FROM users LIMIT 10"
```

### Check Durable Object State

```bash
wrangler durable-objects list
```

### View Real-Time Logs

```bash
wrangler tail --env development
```

### Debug Mode

Run with verbose logging:

```bash
wrangler dev --env development --local
```

## Connecting Frontend to Local API

Update `apps/web/src/App.jsx` to use the local API:

```javascript
const API_BASE_URL = 'http://localhost:8787';
```

Then run the frontend in another terminal:

```bash
cd apps/web
npm run dev
```

## Common Issues

### "Database not found" error

Ensure the `database_id` in `wrangler.toml` matches your local database:

```bash
wrangler d1 list
```

### Port 8787 already in use

Use a different port:

```bash
wrangler dev --env development --port 8788
```

### Schema initialization fails

Verify the SQL file exists and is valid:

```bash
cat infra/cloudflare/schema.sql
```

### Durable Object not persisting state

Check that `blockConcurrencyWhile` is being used correctly in `round-manager.ts`.

## Deployment to Staging

Once local testing is complete, deploy to Cloudflare staging:

```bash
wrangler deploy --env staging
```

## Deployment to Production

After staging verification:

```bash
wrangler deploy --env production
```

## Environment Variables

### Development (.env.local)

```
ENVIRONMENT=development
API_BASE_URL=http://localhost:8787
CONTRACT_ADDRESS=kQBJ8ihO3VrpqT48fK4d9dGaI4la6_OQj72p69wV-Nj0r4_m
```

### Staging

```
ENVIRONMENT=staging
API_BASE_URL=https://staging-api.tontation.io
CONTRACT_ADDRESS=kQBJ8ihO3VrpqT48fK4d9dGaI4la6_OQj72p69wV-Nj0r4_m
```

### Production

```
ENVIRONMENT=production
API_BASE_URL=https://api.tontation.io
CONTRACT_ADDRESS=kQBJ8ihO3VrpqT48fK4d9dGaI4la6_OQj72p69wV-Nj0r4_m
```

## Monitoring Local Development

### Check Request Performance

```bash
wrangler tail --env development --format pretty
```

### Profile CPU Usage

```bash
wrangler dev --env development --inspect-brk
```

## Next Steps

1. **Test Round Transitions**: Verify that rounds automatically advance every 60 seconds
2. **Test Oracle Integration**: Ensure price fetching works correctly
3. **Test Bet Placement**: Verify bets are recorded in the database
4. **Load Testing**: Use a tool like `k6` or `Apache JMeter` to stress test locally

## Support

For issues with Wrangler, see the [official documentation](https://developers.cloudflare.com/workers/wrangler/).
