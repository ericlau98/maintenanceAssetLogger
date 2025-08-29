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
    let timeoutId;
    
    const fetchUserAndProfile = async () => {
      try {
        // Set a timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          console.warn('Auth check timeout - setting loading to false');
          setLoading(false);
        }, 10000); // 10 second timeout
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session:', sessionError);
          setConnectionError(true);
          setLoading(false);
          clearTimeout(timeoutId);
          return;
        }
        
        setConnectionError(false);
        
        if (session?.user) {
          setUser(session.user);
          console.log('Session user:', session.user);
          
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('*, department:departments!profiles_department_id_fkey(*)')
              .eq('id', session.user.id)
              .single();
            
            if (profileError) {
              console.error('Error fetching profile:', profileError);
              // If profile doesn't exist, create it
              if (profileError.code === 'PGRST116') {
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
            } else {
              console.log('Profile data:', profileData);
              setProfile(profileData);
            }
          } catch (profileErr) {
            console.error('Unexpected error fetching profile:', profileErr);
          }
        }
      } catch (error) {
        console.error('Error in fetchUserAndProfile:', error);
      } finally {
        setLoading(false);
        clearTimeout(timeoutId);
      }
    };

    fetchUserAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
      }
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          setUser(session.user);
          
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*, department:departments!profiles_department_id_fkey(*)')
            .eq('id', session.user.id)
            .single();
          
          if (profileError) {
            console.error('Auth state change - Error fetching profile:', profileError);
            // Try to create profile if it doesn't exist
            if (profileError.code === 'PGRST116') {
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
              
              if (!createError) {
                setProfile(newProfile);
              }
            }
          } else {
            setProfile(profileData);
          }
        }
      } else if (!session) {
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
      clearTimeout(timeoutId);
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
      // Attempt to sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      // Clear state regardless of Supabase result
      setUser(null);
      setProfile(null);
      
      return { error };
    } catch (err) {
      console.error('Sign out error:', err);
      // Still clear state even if Supabase call fails
      setUser(null);
      setProfile(null);
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