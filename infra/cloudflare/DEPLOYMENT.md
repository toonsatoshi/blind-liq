# Cloudflare Deployment Guide for TonTation

This guide walks you through deploying TonTation to Cloudflare Workers with D1 Database support.

## Prerequisites

1. **Cloudflare Account**: Create a free account at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Install the Cloudflare Workers CLI
   ```bash
   npm install -g wrangler
   ```
3. **Domain**: A domain registered with Cloudflare (or use a subdomain)

## Step 1: Authenticate with Cloudflare

```bash
wrangler login
```

This will open a browser window to authenticate and grant Cloudflare access to your account.

## Step 2: Create a D1 Database

```bash
wrangler d1 create tontation-db
```

This will output your `database_id`. Copy this value and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "tontation-db"
database_id = "YOUR_DATABASE_ID"  # Replace with your ID
```

## Step 3: Initialize the Database Schema

```bash
wrangler d1 execute tontation-db --file=./infra/cloudflare/schema.sql
```

This will create all the necessary tables and indexes.

## Step 4: Create KV Namespace (Optional, for Caching)

```bash
wrangler kv:namespace create "CACHE"
```

Update `wrangler.toml` with the returned namespace ID:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "YOUR_KV_NAMESPACE_ID"  # Replace with your ID
```

## Step 5: Update wrangler.toml

Replace the placeholder values in `infra/cloudflare/wrangler.toml`:

- `account_id`: Your Cloudflare Account ID (found in Account Settings)
- `YOUR_DATABASE_ID`: The D1 database ID from Step 2
- `YOUR_KV_NAMESPACE_ID`: The KV namespace ID from Step 4 (if using)

## Step 6: Deploy the API

```bash
cd services/api
wrangler deploy --config ../../infra/cloudflare/wrangler.toml
```

The API will be deployed to `https://<project-name>.<account-subdomain>.workers.dev`

## Step 7: Configure Custom Domain (Optional)

To use a custom domain like `api.tontation.io`:

1. Update `wrangler.toml` with your domain:
   ```toml
   routes = [
     { pattern = "api.tontation.io/*", zone_name = "tontation.io" }
   ]
   ```

2. Redeploy:
   ```bash
   wrangler deploy
   ```

## Step 8: Test the API

```bash
# Health check
curl https://<your-api-url>/api/health

# Get user profile
curl https://<your-api-url>/api/profile/0QBJ8ihO3VrpqT48fK4d9dGaI4la6_OQj72p69wV-Nj0r4_m

# Place a bet
curl -X POST https://<your-api-url>/api/bets \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "0QBJ8ihO3VrpqT48fK4d9dGaI4la6_OQj72p69wV-Nj0r4_m",
    "round_id": 1,
    "side": "LONG",
    "amount": 1.5
  }'
```

## Environment-Specific Deployments

### Staging Deployment

```bash
wrangler deploy --env staging
```

### Production Deployment

```bash
wrangler deploy --env production
```

## Monitoring and Logs

View real-time logs:

```bash
wrangler tail
```

View logs for a specific environment:

```bash
wrangler tail --env production
```

## Database Management

### Query the Database

```bash
wrangler d1 execute tontation-db --command "SELECT * FROM users LIMIT 10"
```

### Backup the Database

```bash
wrangler d1 backup create tontation-db
```

### Restore from Backup

```bash
wrangler d1 backup restore tontation-db <backup-id>
```

## Troubleshooting

### "Database not found" error

Ensure the `database_id` in `wrangler.toml` matches your actual database ID:

```bash
wrangler d1 list
```

### "Unauthorized" error

Re-authenticate with Cloudflare:

```bash
wrangler logout
wrangler login
```

### API returns 500 errors

Check the logs:

```bash
wrangler tail
```

## Cost Considerations

- **Workers**: Free tier includes 100,000 requests/day
- **D1 Database**: Free tier includes 5GB storage and 25M read operations/month
- **KV Namespace**: Free tier includes 100,000 operations/day

For production use, consider upgrading to a paid plan.

## Next Steps

1. Update the frontend to use the API endpoints
2. Implement authentication (e.g., wallet signature verification)
3. Set up monitoring and alerting
4. Configure rate limiting
5. Deploy the smart contract to TON Testnet
