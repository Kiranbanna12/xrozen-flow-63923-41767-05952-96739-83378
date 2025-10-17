/**
 * Admin authentication and authorization utilities
 * Uses database-backed role verification for security
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Check if a user has admin role (database-backed)
 * SECURITY: This should only be used for UI hints. 
 * All critical admin checks MUST be done server-side.
 */
export async function isAdminUser(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (error) {
      console.error('Error checking admin role:', error);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
}

/**
 * DEPRECATED: Do not use email-based checks
 * Use isAdminUser() instead with user ID
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  console.warn('⚠️ isAdminEmail is deprecated and insecure. Use isAdminUser() instead.');
  return false;
}
