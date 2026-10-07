<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Data access uses the browser Supabase client with RLS; roles live in `user_roles` checked via `has_role()` — keeps privileges server-enforced.
- Moderation (status/featured) is enforced by the `guard_moderation` DB trigger, so only admins can approve sponsors/promotions.
- Promotion approval notifications are created by a DB trigger (`notify_promotion`), not app code.
- Signed-in areas (/app, /parceiro, /admin) are `ssr:false` layouts guarded by `AppShell`.
- Leaflet map is lazy-loaded behind `<ClientOnly>` because it touches `window` at import.
- Official brand images are CDN pointers rendered by the shared Logo component; the favicon stays local — keeps branding consistent without storing large uploads.
- Home section order and hero live in the single-row `home_config` table so admins control the Home without deploys.
- Benefit codes are validated only via the `validate_usage` security-definer RPC, so sponsors can't edit usage rows directly.
- Community author names are copied onto posts/comments by trigger, since profiles are private under RLS.
