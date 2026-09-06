-- Server-side KV store on Supabase: share links, extraction cache, AI quotas, rate limits.
-- Companion to src/lib/serverStore.ts (the 'supabase' backend).
--
-- Run this once in the production Supabase project (wdpirpbienqxlmlyutaq):
--   Dashboard > SQL Editor > paste > Run
-- Then set SUPABASE_SERVICE_ROLE_KEY in Vercel (Project > Settings > Environment
-- Variables; the key is under Supabase Project Settings > API keys). The app only
-- ever touches this table with the service-role key — never the anon key.

CREATE TABLE IF NOT EXISTS kv_store (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  expires_at TIMESTAMPTZ,          -- NULL = no expiry; reads treat past timestamps as missing
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS on with NO policies: the anon/authenticated roles can do nothing here.
-- The service role bypasses RLS, which is the only intended access path.
ALTER TABLE kv_store ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE kv_store FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_kv_store_expires_at ON kv_store (expires_at);

-- Atomic counter with a TTL window: first increment (or an increment after the
-- previous window expired) resets the count to 1 and starts a new window.
-- Backs per-IP rate limits (fixed minute/hour windows).
CREATE OR REPLACE FUNCTION kv_incr(k TEXT, ttl_seconds INTEGER)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n BIGINT;
BEGIN
  INSERT INTO kv_store AS t (key, value, expires_at)
  VALUES (k, to_jsonb(1::BIGINT), NOW() + make_interval(secs => ttl_seconds))
  ON CONFLICT (key) DO UPDATE
    SET value = CASE
          WHEN t.expires_at IS NOT NULL AND t.expires_at <= NOW() THEN to_jsonb(1::BIGINT)
          ELSE to_jsonb(COALESCE((t.value #>> '{}')::BIGINT, 0) + 1)
        END,
        expires_at = CASE
          WHEN t.expires_at IS NOT NULL AND t.expires_at <= NOW() THEN NOW() + make_interval(secs => ttl_seconds)
          ELSE t.expires_at
        END,
        updated_at = NOW()
  RETURNING (value #>> '{}')::BIGINT INTO n;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION kv_incr(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION kv_incr(TEXT, INTEGER) TO service_role;

-- Expired rows are invisible to the app (reads filter on expires_at) but still take
-- space. Optional daily vacuum; if the pg_cron extension is enabled (Database >
-- Extensions), schedule it with:
--   SELECT cron.schedule('kv-cleanup', '17 3 * * *', $$SELECT kv_cleanup()$$);
CREATE OR REPLACE FUNCTION kv_cleanup()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM kv_store WHERE expires_at IS NOT NULL AND expires_at <= NOW();
$$;

REVOKE EXECUTE ON FUNCTION kv_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION kv_cleanup() TO service_role;
