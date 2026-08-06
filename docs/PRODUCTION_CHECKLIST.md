# ePawati production checklist

## Security

- Rotate every credential that has appeared in chat, screenshots, logs, or source history.
- Use separate access and refresh JWT secrets of at least 32 random bytes.
- Set `AUTH_COOKIE_SECURE=true`, keep `AUTH_COOKIE_SAME_SITE=lax`, and serve only through HTTPS.
- Restrict `CORS_ORIGINS` to the production web origin.
- Keep Supabase service-role credentials server-only and use private receipt/proof buckets.
- Run tenant-isolation tests before every deployment.

## Database

- Back up the database and run `prisma migrate deploy`; never use `db push` in production.
- Use the pooled `DATABASE_URL` for application traffic and `DIRECT_URL` for migrations.
- Apply the receipt-search trigram migration before importing large historical datasets.
- Monitor connection count, lock waits, slow queries, storage growth, and table/index bloat.
- Rehearse restore from backup at least quarterly.

## Runtime

- Prefer the standalone Nest API (`npm run api:build`, then `npm run api:start`) behind `/api/v1` once traffic requires independently scaled API instances.
- Keep the Next-hosted API adapter only for low-volume or transitional deployments.
- Probe `/api/v1/health/live` for liveness and `/api/v1/health/ready` for readiness.
- Set `DATABASE_SLOW_QUERY_MS` (recommended: `500`) and collect structured application logs centrally.
- Drain background WhatsApp jobs from one controlled worker or cron source.

## Release gate

- Run `npm run verify`.
- Run `npm run test:e2e` with dedicated non-production `E2E_USERNAME` and `E2E_PASSWORD`.
- Verify login, year switch, add expense, generate slip, receipt print, WhatsApp share, template upload, reports, and mobile navigation.
- Run migrations before shifting traffic, then verify health and one synthetic receipt.
- Keep a tested rollback image and the previous compatible database migration state.
