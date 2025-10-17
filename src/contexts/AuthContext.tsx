import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  full_name?: string;
  user_category?: 'editor' | 'client' | 'agency';
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ user: any }>;
  signup: (email: string, password: string, metadata?: any) => Promise<{ user: any }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Check if supabase client is available
  if (!supabase) {
    console.error('🔧 AuthContext: Supabase client not available');
    return (
      <AuthContext.Provider value={{
        user: null,
        isLoading: false,
        isAuthenticated: false,
        login: async () => { throw new Error('Supabase not configured'); },
        signup: async () => { throw new Error('Supabase not configured'); },
        logout: async () => { throw new Error('Supabase not configured'); },
        refreshUser: async () => { throw new Error('Supabase not configured'); },
      }}>
        {children}
      </AuthContext.Provider>
    );
  }

  const login = async (email: string, password: string) => {
    try {
      console.log('🔧 AuthContext: Starting login with Supabase');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      if (data.user) {
        // Get profile data
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        const userData: User = {
          id: data.user.id,
          email: data.user.email!,
          full_name: profile?.full_name,
          user_category: profile?.user_category,
          created_at: data.user.created_at,
        };
        
        setUser(userData);
        console.log('🔧 AuthContext: Login successful');
        return { user: userData };
      }
      
      throw new Error('Login failed');
    } catch (error) {
      console.error('🔧 AuthContext: Login failed:', error);
      throw error;
    }
  };

  const signup = async (email: string, password: string, metadata?: any) => {
    try {
      console.log('🔧 AuthContext: Starting signup with Supabase');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      
      if (error) throw error;
      
      if (data.user) {
        const userData: User = {
          id: data.user.id,
          email: data.user.email!,
          full_name: metadata?.full_name,
          user_category: metadata?.user_category,
          created_at: data.user.created_at,
        };
        
        setUser(userData);
        console.log('🔧 AuthContext: Signup successful');
        return { user: userData };
      }
      
      throw new Error('Signup failed');
    } catch (error) {
      console.error('🔧 AuthContext: Signup failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('🔧 AuthContext: Starting logout');
      await supabase.auth.signOut();
    } catch (error) {
      console.error('🔧 AuthContext: Logout failed:', error);
    } finally {
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        
        const userData: User = {
          id: authUser.id,
          email: authUser.email!,
          full_name: profile?.full_name,
          user_category: profile?.user_category,
          created_at: authUser.created_at,
        };
        
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('🔧 AuthContext: Failed to refresh user:', error);
      setUser(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    const initializeAuth = async () => {
      console.log('🔧 AuthContext: Initializing Supabase authentication');
      setIsLoading(true);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && mounted) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          const userData: User = {
            id: session.user.id,
            email: session.user.email!,
            full_name: profile?.full_name,
            user_category: profile?.user_category,
            created_at: session.user.created_at,
          };
          
          setUser(userData);
          console.log('🔧 AuthContext: User session restored');
        } else if (mounted) {
          setUser(null);
        }
      } catch (error) {
        console.error('🔧 AuthContext: Auth initialization failed:', error);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔧 AuthContext: Auth state changed:', event);
      
      if (session?.user && mounted) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        const userData: User = {
          id: session.user.id,
          email: session.user.email!,
          full_name: profile?.full_name,
          user_category: profile?.user_category,
          created_at: session.user.created_at,
        };
        
        setUser(userData);
      } else if (mounted) {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    signup,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
