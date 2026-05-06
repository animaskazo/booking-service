// ============================================================================
// AUTH PROVIDER — Single subscription, shared context
// ============================================================================
// Replaces the old useAuth() hook that created independent subscriptions
// per call. Now there is ONE listener and all consumers share the same state.

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase-client';

interface AuthContextValue {
  session: any;
  user: any;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session — runs ONCE
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Single global listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = React.useMemo(
    () => ({ session, user: session?.user ?? null, loading }),
    [session, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to consume the auth context.
 * MUST be used within an AuthProvider.
 * Does NOT create its own subscription — reads from the single global one.
 */
export const useAuth = (): AuthContextValue => {
  return useContext(AuthContext);
};
