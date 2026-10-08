# Exotic Club — app iOS

App do Exotic Club em React Native (Expo SDK 57) com backend no Supabase.

## Configuração

1. `cp .env.example .env.local` e preencha a URL e a chave **publishable** do Supabase.
2. `npm install`
3. Banco: `npx supabase login`, `npx supabase link --project-ref <ref>` e `npm run db:push`.
4. Admins não são criados pelo app. Depois de criar a conta, rode no SQL Editor:
   `select public.make_admin('email@do-dono.com');`

## Comandos

- `npx expo run:ios`: compila e abre no simulador ou no iPhone conectado
- `npm test`: testes unitários
- `npm run typecheck`, `npx expo lint`

## Regras

- Nada secreto no app: só a chave publishable. Toda permissão é validada no banco
  (RLS + funções `security definer`) ou nas Edge Functions.
- `ios/` é gerado por `npx expo prebuild`. Não edite à mão.
