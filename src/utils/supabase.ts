import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Only create client if credentials are available
let supabaseClient: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
} else {
  console.warn('Supabase credentials not configured - auth features disabled');
}

// Export the client (may be null if not configured)
export const supabase = supabaseClient;

// Helper to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

// Auth helpers
export async function signInWithGoogle() {
  if (!supabase) return { data: null, error: new Error('Auth not configured') };
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { data, error };
}

export async function signInWithEmail(email: string) {
  if (!supabase) return { data: null, error: new Error('Auth not configured') };
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { data, error };
}

export async function signOut() {
  if (!supabase) return { error: new Error('Auth not configured') };
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession() {
  if (!supabase) return { session: null, error: null };
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
}

export async function getUser() {
  if (!supabase) return { user: null, error: null };
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

// Subscribe to auth changes
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange(callback);
}

// Server-side: Get user ID from request cookies
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  // Supabase stores tokens in cookies with specific naming pattern
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  // Parse cookies
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name && rest.length) {
      cookies[name] = rest.join('=');
    }
  });

  // Look for Supabase auth token cookie (sb-<project-ref>-auth-token)
  const authCookieName = Object.keys(cookies).find(
    (name) => name.startsWith('sb-') && name.endsWith('-auth-token')
  );

  if (!authCookieName) return null;

  try {
    // The cookie value is a base64-encoded JSON with access_token
    const cookieValue = decodeURIComponent(cookies[authCookieName]);
    const parsed = JSON.parse(cookieValue);
    const accessToken = parsed?.access_token;

    if (!accessToken) return null;

    // Verify the token by calling Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const serverClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const { data: { user }, error } = await serverClient.auth.getUser(accessToken);

    if (error || !user) return null;

    return user.id;
  } catch {
    return null;
  }
}
