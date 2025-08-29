import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        // First, try to get session with a shorter timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session timeout')), 5000)
        );
        
        let session;
        try {
          const result = await Promise.race([sessionPromise, timeoutPromise]);
          session = result.data?.session;
        } catch (timeoutError) {
          console.warn('Session check timed out, trying to refresh...');
          // Try to refresh the session if the initial check times out
          try {
            const refreshResult = await supabase.auth.refreshSession();
            session = refreshResult.data?.session;
          } catch (refreshError) {
            console.error('Failed to refresh session:', refreshError);
            setLoading(false);
            return;
          }
        }
        
        setConnectionError(false);
        
        if (session?.user) {
          setUser(session.user);
          console.log('Session user:', session.user);
          
          // Fetch profile separately with its own timeout
          const profilePromise = supabase
            .from('profiles')
            .select('*, department:departments!profiles_department_id_fkey(*)')
            .eq('id', session.user.id)
            .single();
          
          const profileTimeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Profile timeout')), 5000)
          );
          
          try {
            const { data: profileData, error: profileError } = await Promise.race([
              profilePromise,
              profileTimeoutPromise
            ]);
            
            if (profileError) {
              console.error('Error fetching profile:', profileError);
              // If profile doesn't exist, create it
              if (profileError?.code === 'PGRST116') {
                console.log('Profile not found, creating one...');
                const { data: newProfile, error: createError } = await supabase
                  .from('profiles')
                  .insert({
                    id: session.user.id,
                    email: session.user.email,
                    full_name: session.user.user_metadata?.full_name || '',
                    role: 'user'
                  })
                  .select('*, department:departments!profiles_department_id_fkey(*)')
                  .single();
                
                if (createError) {
                  console.error('Error creating profile:', createError);
                } else {
                  setProfile(newProfile);
                }
              }
            } else if (profileData) {
              console.log('Profile data:', profileData);
              setProfile(profileData);
            }
          } catch (profileTimeoutError) {
            console.warn('Profile fetch timed out, continuing without profile');
            // Set a minimal profile so the user can still use the app
            setProfile({ 
              id: session.user.id, 
              email: session.user.email,
              role: 'user' 
            });
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('Error in fetchUserAndProfile:', error);
        setConnectionError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
      }
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      
      if (session?.user) {
        setUser(session.user);
        
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*, department:departments!profiles_department_id_fkey(*)')
          .eq('id', session.user.id)
          .single();
        
        if (profileError) {
          console.error('Auth state change - Error fetching profile:', profileError);
        } else {
          setProfile(profileData);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      
      setLoading(false);
    });

    // Set up a periodic session check every 30 seconds
    const sessionCheckInterval = setInterval(async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        // Try to refresh the session
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !newSession) {
          console.error('Session expired, redirecting to login');
          setUser(null);
          setProfile(null);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => {
      authListener?.subscription.unsubscribe();
      clearInterval(sessionCheckInterval);
    };
  }, []);

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    
    // Note: Keep "Confirm email" ENABLED in Supabase Dashboard
    // This ensures proper email verification flow
    // We'll just override the email template that gets sent
    
    return { data, error };
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (!error) {
        setUser(null);
        setProfile(null);
        // Clear any stored session data
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.clear();
      }
      return { error };
    } catch (err) {
      console.error('Sign out error:', err);
      return { error: err };
    }
  };

  // Role checking helpers
  const isGlobalAdmin = profile?.role === 'global_admin' || profile?.role === 'admin';
  const isMaintenanceAdmin = profile?.role === 'maintenance_admin';
  const isElectricalAdmin = profile?.role === 'electrical_admin';
  const isDepartmentAdmin = isMaintenanceAdmin || isElectricalAdmin;
  const isAnyAdmin = isGlobalAdmin || isDepartmentAdmin;
  const isAdmin = isAnyAdmin; // Backward compatibility
  
  // Check if user can manage a specific department
  const canManageDepartment = (departmentId) => {
    if (isGlobalAdmin) return true;
    if (isDepartmentAdmin && profile?.department_id === departmentId) return true;
    return false;
  };

  const retryConnection = () => {
    console.log('Retrying connection...');
    setLoading(true);
    setConnectionError(false);
    window.location.reload();
  };

  const value = {
    user,
    profile,
    isAdmin,
    isGlobalAdmin,
    isMaintenanceAdmin,
    isElectricalAdmin,
    isDepartmentAdmin,
    isAnyAdmin,
    canManageDepartment,
    loading,
    connectionError,
    retryConnection,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};