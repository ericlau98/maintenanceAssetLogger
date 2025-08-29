import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  }
});

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
    
  return { ...user, profile };
};

export const isAdmin = async () => {
  const user = await getCurrentUser();
  return user?.profile?.role === 'admin';
};

// Helper to refresh session if expired
export const refreshSession = async () => {
  const { data: { session }, error } = await supabase.auth.refreshSession();
  if (error) {
    console.error('Error refreshing session:', error);
    // If refresh fails, redirect to login
    window.location.href = '/login';
    return null;
  }
  return session;
};

// Wrapper for database queries with automatic retry on auth errors
export const supabaseQuery = async (queryFn, retries = 1) => {
  try {
    const result = await queryFn();
    
    // Check if we got an auth error
    if (result.error?.message?.includes('JWT') || result.error?.code === 'PGRST301') {
      if (retries > 0) {
        // Try to refresh the session
        const session = await refreshSession();
        if (session) {
          // Retry the query
          return supabaseQuery(queryFn, retries - 1);
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error('Query error:', error);
    return { data: null, error };
  }
};