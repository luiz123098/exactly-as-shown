-- Supabase advisor: keep pg_net out of the public schema. Its functions live in
-- the "net" schema either way, so the news-sync cron job is unaffected.
drop extension if exists pg_net;
create extension pg_net schema extensions;
