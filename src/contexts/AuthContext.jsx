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
    let isMounted = true;

    const fetchUserAndProfile = async () => {
      try {
        console.log('Checking for existing session...');
        
        // Get the current session from Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (sessionError) {
          console.error('Error getting session:', sessionError);
          setConnectionError(true);
          setLoading(false);
          return;
        }
        
        if (!session) {
          console.log('No active session found');
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        
        console.log('Session found for user:', session.user.email);
        setUser(session.user);
        setConnectionError(false);
        
        // Fetch the user's profile
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*, department:departments!profiles_department_id_fkey(*)')
            .eq('id', session.user.id)
            .single();
          
          if (!isMounted) return;
          
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
              
              if (!isMounted) return;
              
              if (createError) {
                console.error('Error creating profile:', createError);
              } else {
                setProfile(newProfile);
              }
            }
          } else {
            console.log('Profile loaded:', profileData.email);
            setProfile(profileData);
          }
        } catch (profileErr) {
          console.error('Unexpected error fetching profile:', profileErr);
        }
        
        if (isMounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error in fetchUserAndProfile:', error);
        if (isMounted) {
          setConnectionError(true);
          setLoading(false);
        }
      }
    };

    fetchUserAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('User signed in:', session.user.email);
        setUser(session.user);
        
        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*, department:departments!profiles_department_id_fkey(*)')
          .eq('id', session.user.id)
          .single();
        
        if (profileError) {
          console.error('Auth state change - Error fetching profile:', profileError);
          // If profile doesn't exist, create it
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
        
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('Token refreshed for user:', session.user.email);
        // Update user in case anything changed
        setUser(session.user);
      } else if (event === 'USER_UPDATED' && session?.user) {
        console.log('User updated:', session.user.email);
        setUser(session.user);
      }
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
      isMounted = false;
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