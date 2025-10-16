import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { serverId, status, supabasePort } = await req.json();

    console.log(`Updating server ${serverId} with status: ${status}, port: ${supabasePort}`);

    // Update server status
    const { error } = await supabase
      .from('servers')
      .update({
        status: status,
        supabase_port: supabasePort || 9000,
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', serverId);

    if (error) {
      console.error('Database update error:', error);
      throw error;
    }

    console.log(`Server ${serverId} updated successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Server registered successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
