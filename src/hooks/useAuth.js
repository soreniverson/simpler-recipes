import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, signOut as supabaseSignOut } from '../utils/supabase';
import { syncOnLogin, clearSyncState } from '../utils/sync';

/**
 * Hook to get current auth state
 * Returns: { user, session, loading, signOut, isAuthenticated, syncing }
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Handle sync on login
  const performSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncOnLogin();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }, []);

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

      // Sync on initial load if already logged in
      if (session?.user) {
        performSync();
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Sync when user signs in
        if (event === 'SIGNED_IN' && session?.user) {
          performSync();
        }

        // Clear sync state on sign out
        if (event === 'SIGNED_OUT') {
          clearSyncState();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [performSync]);

  const handleSignOut = async () => {
    await supabaseSignOut();
    clearSyncState();
    setUser(null);
    setSession(null);
  };

  return {
    user,
    session,
    loading,
    syncing,
    isAuthenticated: !!user,
    signOut: handleSignOut,
  };
}
