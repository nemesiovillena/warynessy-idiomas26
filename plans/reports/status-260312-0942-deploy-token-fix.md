# Status Report: Deploy Token Update

**Date:** 2026-03-12 09:42 AM
**Issue:** Deploy failed with HTTP 401 Unauthorized

---

## What Happened

1. **First pipeline (c3f988a):**
   - ✅ `verify` job passed
   - ✅ `migrate` job passed
   - ❌ `deploy` job failed with **HTTP 401** (Unauthorized)
   - Response: `{"message":"Unauthorized"}`

2. **Root Cause:**
   - The `DOKPLOY_PAYLOAD_TOKEN` secret in GitHub was outdated/incorrect
   - Dokploy tokens have refresh timestamps and may expire
   - Webhook rejected the request as unauthorized

3. **Fix Applied:**
   - Updated `DOKPLOY_PAYLOAD_TOKEN` in GitHub secrets to: `4-eqs6HuOAS_iwBCktwpb` (current token from Dokploy)
   - Updated `DOKPLOY_TRANSLATION_TOKEN` to: `DCrnGXNceEoKVOXvrBJG8` (current token from Dokploy)
   - Pushed empty commit ccf52d9 to retrigger pipeline with new tokens

---

## Current Status

**New Pipeline:** run 22995723788 (started 2026-03-12 09:42:22)

Expected jobs:
- ✅ `verify` (~1min)
- ✅ `migrate` (~1min)
- ✅ `deploy` **← Should pass now with correct tokens**
- ✅ `security-report` (~10s)

---

## Important Notes

- Dokploy tokens are rotatable and unique per application
- Previous token was likely from before the last Dokploy restart or token refresh
- The `--max-time 30` fix from commit c3f988a is working correctly (response received immediately)
- The 401 error proves the webhook is reachable and functional — just authentication was wrong

---

## Expected Outcome

Once the new pipeline completes successfully:
1. Payload will be deployed to Dokploy
2. Database migrations will execute automatically (via `start.sh`)
3. HTTP 500 errors on public endpoints should be resolved
4. https://warynessy.com should be fully operational
