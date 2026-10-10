-- Runs news-sync every hour (minute 7). The shared secret lives in Vault
-- ('news_sync_secret') and in the function's CRON_SECRET; it is never in git.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('news-sync', '7 * * * *', $$
  select net.http_post(
    url := 'https://ohfhaaqkaymihscfqpqi.supabase.co/functions/v1/news-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'news_sync_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$$);
