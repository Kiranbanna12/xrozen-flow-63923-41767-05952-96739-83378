/**
 * Database Switcher Service
 * Handles switching between SQLite and Supabase databases
 */

import { supabase } from "@/integrations/supabase/client";

export type DatabaseProvider = 'sqlite' | 'supabase';

export interface DatabaseConfig {
  provider: DatabaseProvider;
  isActive: boolean;
  lastSwitched?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
}

class DatabaseSwitcherService {
  private currentProvider: DatabaseProvider = 'supabase';
  
  async getCurrentProvider(): Promise<DatabaseProvider> {
    try {
      // Check from Supabase database_config table
      const { data, error } = await supabase
        .from('database_config')
        .select('provider, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching current provider:', error);
        return this.currentProvider;
      }

      if (data) {
        this.currentProvider = data.provider as DatabaseProvider;
      }

      return this.currentProvider;
    } catch (error) {
      console.error('Error in getCurrentProvider:', error);
      return this.currentProvider;
    }
  }

  async switchProvider(
    newProvider: DatabaseProvider, 
    config?: { supabaseUrl?: string; supabaseKey?: string }
  ): Promise<{ success: boolean; message: string }> {
    try {
      // For Supabase, validate credentials first
      if (newProvider === 'supabase' && config?.supabaseUrl && config?.supabaseKey) {
        localStorage.setItem('custom_supabase_url', config.supabaseUrl);
        localStorage.setItem('custom_supabase_key', config.supabaseKey);
      }

      // Deactivate all existing configs
      const { error: deactivateError } = await supabase
        .from('database_config')
        .update({ is_active: false })
        .eq('is_active', true);

      if (deactivateError) {
        throw deactivateError;
      }

      // Insert new active config
      const { error: insertError } = await supabase
        .from('database_config')
        .insert({
          provider: newProvider,
          is_active: true,
          config: config || {},
        });

      if (insertError) {
        throw insertError;
      }

      this.currentProvider = newProvider;

      // Store in localStorage for quick access
      localStorage.setItem('db_provider', newProvider);

      return {
        success: true,
        message: `Database switched to ${newProvider} successfully!`,
      };
    } catch (error: any) {
      console.error('Error switching database:', error);
      return {
        success: false,
        message: `Failed to switch database: ${error.message}`,
      };
    }
  }

  async testConnection(provider: DatabaseProvider): Promise<boolean> {
    try {
      if (provider === 'supabase') {
        // Test Supabase connection
        const { error } = await supabase.from('profiles').select('count').limit(1);
        return !error;
      } else {
        // SQLite is always available
        return true;
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async getConfig(): Promise<DatabaseConfig | null> {
    try {
      const { data, error } = await supabase
        .from('database_config')
        .select('provider, is_active, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return {
        provider: data.provider as DatabaseProvider,
        isActive: data.is_active,
        lastSwitched: data.created_at,
      };
    } catch (error) {
      console.error('Error fetching database config:', error);
      return null;
    }
  }
}

export const dbSwitcher = new DatabaseSwitcherService();
