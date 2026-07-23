-- One-time setup for the assistant's read-only database access (layer 1 of 3).
-- Run as the owner role. Replace the password before running; it becomes part
-- of ASSISTANT_DB_URL on the Cloud Run service.
--   psql "$SUPABASE_OWNER_URL" -f create-assistant-role.sql

CREATE ROLE yars_assistant_ro LOGIN PASSWORD 'REPLACE_ME_STRONG_PASSWORD';

GRANT CONNECT ON DATABASE postgres TO yars_assistant_ro;
GRANT USAGE ON SCHEMA public TO yars_assistant_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO yars_assistant_ro;

-- Future tables created by migrations are readable automatically:
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO yars_assistant_ro;

-- Belt and braces: this role can never write, even if a grant slips through.
ALTER ROLE yars_assistant_ro SET default_transaction_read_only = on;
ALTER ROLE yars_assistant_ro SET statement_timeout = '5s';
