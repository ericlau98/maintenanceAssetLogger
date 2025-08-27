import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        console.log('Session user:', session.user);
        
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
      }
      
      setLoading(false);
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
    // First, create the user account with email confirmation disabled
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

    // If signup successful, send custom confirmation email
    if (data?.user && !error) {
      try {
        // Generate confirmation URL (Supabase provides this in the response)
        const confirmationUrl = `${window.location.origin}/auth/confirm?token_hash=${data.user.confirmation_token}&type=signup`;
        
        // Call our custom email function
        const { error: emailError } = await supabase.functions.invoke('send-auth-email', {
          body: {
            type: 'signup',
            email: email,
            data: {
              full_name: fullName,
              confirmation_url: data.user?.email_confirm_token_url || confirmationUrl
            }
          }
        });

        if (emailError) {
          console.error('Failed to send custom confirmation email:', emailError);
          // Fall back to default Supabase email
        }
      } catch (err) {
        console.error('Error sending custom email:', err);
      }
    }

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
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};