import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, signOut as supabaseSignOut } from '../utils/supabase';

/**
 * Hook to get current auth state
 * Returns: { user, session, loading, signOut, isAuthenticated }
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabaseSignOut();
    setUser(null);
    setSession(null);
  };

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    signOut: handleSignOut,
  };
}
