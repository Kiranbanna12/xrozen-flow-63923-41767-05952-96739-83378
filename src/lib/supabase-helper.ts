import { supabase } from "@/integrations/supabase/client";

// Temporary helper to bypass TypeScript errors until types are regenerated
export const getSupabaseClient = () => supabase as any;
