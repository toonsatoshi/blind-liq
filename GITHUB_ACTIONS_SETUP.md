# GitHub Actions Setup for Automated Cloudflare Deployment

This guide helps you set up automated deployment to Cloudflare using GitHub Actions.

## Prerequisites

1. **GitHub Repository**: Your TonTation repo (already set up)
2. **Cloudflare Account**: Free or paid account
3. **Cloudflare API Token**: Generated in your account settings

## Step 1: Generate Cloudflare API Token

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **Account Settings** → **API Tokens**
3. Click **Create Token**
4. Use the **"Edit Cloudflare Workers"** template
5. Grant permissions:
   - ✅ Account Resources: All accounts
   - ✅ Zone Resources: All zones
   - ✅ Permissions: Workers Scripts (Read & Edit)
6. Click **Continue to summary**
7. Click **Create Token**
8. **Copy the token** (you won't see it again!)

## Step 2: Get Your Cloudflare Account ID

1. In the Cloudflare Dashboard, go to **Account Settings**
2. Look for **Account ID** in the right sidebar
3. Copy this value

## Step 3: Get Your Database ID

If you've already created a D1 database:

```bash
wrangler d1 list
```

Copy the `database_id` for your production database.

## Step 4: Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add:

| Secret Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Your API token from Step 1 |
| `CLOUDFLARE_ACCOUNT_ID` | Your account ID from Step 2 |
| `CLOUDFLARE_DATABASE_ID` | Your D1 database ID from Step 3 |
| `CLOUDFLARE_KV_NAMESPACE_ID` | Your KV namespace ID (if using) |

## Step 5: Verify the Workflow

The workflow file is already created at `.github/workflows/deploy-cloudflare.yml`

To verify it's correct:

```bash
cat .github/workflows/deploy-cloudflare.yml
```

## Step 6: Test the Deployment

Push a change to trigger the workflow:

```bash
git add .
git commit -m "Test GitHub Actions deployment"
git push origin main
```

Go to **GitHub Actions** tab in your repository to see the deployment progress.

## Workflow Behavior

### Automatic Deployment Triggers

The workflow automatically deploys when:
- Code is pushed to the `main` branch
- Changes are made to:
  - `services/api/**`
  - `infra/cloudflare/**`
  - `.github/workflows/deploy-cloudflare.yml`

### Manual Deployment

To manually trigger a deployment:

1. Go to **Actions** tab
2. Select **Deploy to Cloudflare** workflow
3. Click **Run workflow**
4. Select the branch and click **Run workflow**

## Monitoring Deployments

### View Deployment Logs

1. Go to **Actions** tab
2. Click the workflow run
3. Click **Deploy API to Cloudflare Workers** job
4. View the logs

### Check Deployment Status

```bash
wrangler deployments list --env production
```

## Troubleshooting

### "Unauthorized" Error

- Verify your API token is correct
- Check that the token hasn't expired
- Regenerate a new token if needed

### "Database not found" Error

- Verify `CLOUDFLARE_DATABASE_ID` secret is set correctly
- Check that the database exists: `wrangler d1 list`

### Workflow Not Triggering

- Ensure the workflow file is in `.github/workflows/`
- Check that the branch is `main`
- Verify the file paths in the `paths` filter match your changes

### Deployment Timeout

- Check Wrangler logs: `wrangler tail --env production`
- Increase the timeout in the workflow if needed
- Check for database connection issues

## Advanced Configuration

### Deploy to Multiple Environments

To deploy to staging and production separately:

```yaml
jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      # ... deploy to staging ...

  deploy-production:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      # ... deploy to production ...
```

### Add Slack Notifications

Add to your workflow:

```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "TonTation API deployed successfully! 🚀"
      }
```

### Add Email Notifications

GitHub Actions can send email notifications automatically. Configure in:
- **Settings** → **Notifications** → **Email notifications**

## Rollback Procedure

If a deployment breaks production:

1. Revert the commit:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. The workflow will automatically redeploy the previous version

3. Check the deployment:
   ```bash
   wrangler deployments list --env production
   ```

## Security Best Practices

1. **Rotate API Tokens**: Regenerate tokens every 90 days
2. **Limit Token Scope**: Only grant necessary permissions
3. **Use Branch Protection**: Require reviews before merging to `main`
4. **Audit Logs**: Check Cloudflare audit logs for deployments

## Next Steps

1. ✅ Set up GitHub Secrets
2. ✅ Push code to trigger the workflow
3. ✅ Monitor the deployment in GitHub Actions
4. ✅ Verify the API is live: `curl https://api.tontation.io/api/health`
5. ✅ Set up monitoring and alerts

## Support

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cloudflare Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare API Token Documentation](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
