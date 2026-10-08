import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { kindOf, type Access, type Kind } from '@/lib/access';
import { supabase } from '@/lib/supabase';

export type { Access, Kind } from '@/lib/access';

type AuthState = {
  ready: boolean;
  session: Session | null;
  access: Access | null;
  kind: Kind | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [ready, setReady] = useState(false);

  const loadAccess = useCallback(async (s: Session | null) => {
    if (!s) {
      setAccess(null);
      setReady(true);
      return;
    }
    const { data, error } = await supabase.rpc('my_access');
    // On a failed load keep the previous access instead of downgrading the user.
    if (!error) setAccess(data as Access);
    setReady(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadAccess(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Calling Supabase inside this callback can deadlock; defer it.
      if (event !== 'TOKEN_REFRESHED') setTimeout(() => loadAccess(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadAccess]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      access,
      kind: session && access ? kindOf(access) : null,
      refresh: () => loadAccess(session),
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [ready, session, access, loadAccess],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}
