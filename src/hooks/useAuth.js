import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, signOut as supabaseSignOut } from '../utils/supabase';
import { syncOnLogin, clearSyncState } from '../utils/sync';

/**
 * Mirror the access token into a short-lived cookie so server routes (extraction quota) can
 * verify the user. supabase-js stores sessions in localStorage, which the server never sees.
 */
function setAuthCookie(session) {
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    if (session?.access_token) {
      const ttl = Math.max(60, Math.min(60 * 60, (session.expires_at || 0) - Math.floor(Date.now() / 1000)));
      document.cookie = `sr_auth=${session.access_token}; path=/; max-age=${ttl}; SameSite=Lax${secure}`;
    } else {
      document.cookie = `sr_auth=; path=/; max-age=0; SameSite=Lax${secure}`;
    }
  } catch {}
}

/**
 * Hook to get current auth state
 * Returns: { user, session, loading, signOut, isAuthenticated, syncing }
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Handle sync on login — at most once per 10 minutes per tab (the header is on every page,
  // so without this every page view did a full pull/merge/upsert round-trip).
  const performSync = useCallback(async () => {
    try {
      const last = Number(sessionStorage.getItem('sr:last-sync') || 0);
      if (Date.now() - last < 10 * 60 * 1000) return;
      sessionStorage.setItem('sr:last-sync', String(Date.now()));
    } catch {}
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
      setAuthCookie(session);
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
        setAuthCookie(session);

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
    setAuthCookie(null);
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
