# Cloudflare Deployment Checklist

Use this checklist to ensure a smooth deployment of TonTation to Cloudflare.

## Pre-Deployment (Local Testing)

- [ ] Clone the repository: `git clone https://github.com/toonsatoshi/TonTation.git`
- [ ] Install dependencies: `npm install`
- [ ] Install Wrangler: `npm install -g wrangler`
- [ ] Authenticate with Cloudflare: `wrangler login`
- [ ] Create local D1 database: `wrangler d1 create tontation-db-local`
- [ ] Update `wrangler.toml` with local database ID
- [ ] Initialize database schema: `wrangler d1 execute tontation-db-local --file=./infra/cloudflare/schema.sql`
- [ ] Build API service: `cd services/api && npm run build`
- [ ] Start local dev server: `wrangler dev --env development`
- [ ] Test API endpoints (health check, profile, bets)
- [ ] Connect frontend to local API and test
- [ ] Verify round transitions work correctly
- [ ] Test bet placement and ledger recording

## GitHub Actions Setup

- [ ] Generate Cloudflare API Token (see GITHUB_ACTIONS_SETUP.md)
- [ ] Get Cloudflare Account ID
- [ ] Create D1 database for production
- [ ] Get production database ID
- [ ] Add GitHub Secrets:
  - [ ] `CLOUDFLARE_API_TOKEN`
  - [ ] `CLOUDFLARE_ACCOUNT_ID`
  - [ ] `CLOUDFLARE_DATABASE_ID`
  - [ ] `CLOUDFLARE_KV_NAMESPACE_ID` (if using KV)
- [ ] Verify workflow file exists: `.github/workflows/deploy-cloudflare.yml`
- [ ] Test workflow by pushing a small change to `main`

## Staging Deployment

- [ ] Create staging D1 database: `wrangler d1 create tontation-db-staging`
- [ ] Update `wrangler.toml` staging section with database ID
- [ ] Deploy to staging: `wrangler deploy --env staging`
- [ ] Test all endpoints on staging
- [ ] Verify round coordination works
- [ ] Test bet placement and payouts
- [ ] Monitor logs: `wrangler tail --env staging`
- [ ] Load test the staging environment
- [ ] Check database performance

## Production Deployment

- [ ] Create production D1 database: `wrangler d1 create tontation-db-prod`
- [ ] Update `wrangler.toml` production section with database ID
- [ ] Initialize production schema: `wrangler d1 execute tontation-db-prod --file=./infra/cloudflare/schema.sql`
- [ ] Deploy to production: `wrangler deploy --env production`
- [ ] Verify API is live: `curl https://api.tontation.io/api/health`
- [ ] Test all endpoints on production
- [ ] Verify round coordination is running
- [ ] Monitor logs: `wrangler tail --env production`
- [ ] Set up monitoring and alerts

## Post-Deployment

- [ ] Update frontend API_BASE_URL to production URL
- [ ] Deploy frontend to production
- [ ] Verify end-to-end flow (wallet → bet → ledger)
- [ ] Monitor for errors and performance issues
- [ ] Set up Cloudflare analytics
- [ ] Configure rate limiting
- [ ] Enable DDoS protection
- [ ] Set up backup procedures
- [ ] Document any custom configurations

## Monitoring & Maintenance

- [ ] Set up log aggregation (e.g., Datadog, New Relic)
- [ ] Configure alerts for:
  - [ ] High error rates
  - [ ] Round settlement failures
  - [ ] Database connection issues
  - [ ] API latency > 1s
- [ ] Schedule weekly health checks
- [ ] Monitor Cloudflare usage and costs
- [ ] Plan for scaling if needed
- [ ] Keep dependencies updated

## Security Checklist

- [ ] Enable Cloudflare WAF (Web Application Firewall)
- [ ] Configure rate limiting per IP
- [ ] Set up DDoS protection
- [ ] Enable HTTPS (should be automatic)
- [ ] Rotate API tokens every 90 days
- [ ] Review GitHub Actions secrets regularly
- [ ] Audit Cloudflare access logs
- [ ] Implement request signing for critical endpoints
- [ ] Set up IP whitelisting if needed

## Rollback Procedure

If something goes wrong:

1. [ ] Identify the issue
2. [ ] Revert the commit: `git revert <commit-hash>`
3. [ ] Push to main: `git push origin main`
4. [ ] GitHub Actions will automatically redeploy
5. [ ] Verify the rollback: `curl https://api.tontation.io/api/health`
6. [ ] Check logs for errors: `wrangler tail --env production`
7. [ ] Communicate status to users

## Testing Scenarios

### Round Advancement
- [ ] Verify round ID increments every 60 seconds
- [ ] Verify round status transitions: OPEN → LOCKED → SETTLING → CLOSED
- [ ] Verify prices are fetched correctly
- [ ] Verify winner is determined correctly

### Bet Placement
- [ ] Place a LONG bet during OPEN phase
- [ ] Place a SHORT bet during OPEN phase
- [ ] Attempt bet during LOCKED phase (should fail)
- [ ] Verify bet is recorded in ledger
- [ ] Verify pools are updated correctly

### Payout Calculation
- [ ] Verify LONG winner gets correct payout
- [ ] Verify SHORT winner gets correct payout
- [ ] Verify TIE results in refunds
- [ ] Verify protocol fee is deducted
- [ ] Verify zero-sum invariant holds

### User Ledger
- [ ] Verify user can view transaction history
- [ ] Verify user profile shows correct statistics
- [ ] Verify history persists across sessions
- [ ] Verify ledger entries are immutable

## Performance Benchmarks

- [ ] API response time < 200ms (p95)
- [ ] Database queries < 50ms
- [ ] Round settlement < 500ms
- [ ] Concurrent users: 1000+
- [ ] Throughput: 100+ requests/second

## Documentation

- [ ] Update README with deployment instructions
- [ ] Document API endpoints
- [ ] Document database schema
- [ ] Document environment variables
- [ ] Create troubleshooting guide
- [ ] Create runbook for common issues

## Final Verification

- [ ] All tests pass
- [ ] No console errors
- [ ] No database errors
- [ ] Monitoring is active
- [ ] Alerts are configured
- [ ] Team is trained on deployment
- [ ] Rollback procedure is documented
- [ ] Ready for launch! 🚀

---

## Quick Reference

### Useful Commands

```bash
# Local development
wrangler dev --env development

# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production

# View logs
wrangler tail --env production

# Check deployments
wrangler deployments list --env production

# Query database
wrangler d1 execute tontation-db-prod --command "SELECT * FROM rounds LIMIT 10"
```

### Important URLs

- **Development**: `http://localhost:8787`
- **Staging**: `https://staging-api.tontation.io`
- **Production**: `https://api.tontation.io`

### Support Contacts

- Cloudflare Support: https://support.cloudflare.com/
- GitHub Support: https://support.github.com/
- Your Team: [Add your contact info]
