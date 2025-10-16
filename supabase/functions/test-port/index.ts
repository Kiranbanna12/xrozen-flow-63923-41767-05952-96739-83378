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
    const { serverId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get server details
    const { data: server, error } = await supabase
      .from('servers')
      .select('*')
      .eq('id', serverId)
      .single();

    if (error || !server) {
      throw new Error('Server not found');
    }

    console.log(`Testing port ${server.supabase_port} on ${server.ip_address}`);

    // Test external connectivity
    const testUrl = `http://${server.ip_address}:${server.supabase_port}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const accessible = response.status < 500;
      
      // Update server status
      await supabase
        .from('servers')
        .update({
          status: accessible ? 'online' : 'error',
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', serverId);

      return new Response(
        JSON.stringify({
          success: true,
          accessible,
          port: server.supabase_port,
          url: testUrl,
          status: response.status,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } catch (fetchError) {
      console.error('Port test failed:', fetchError);
      
      // Update server status to error
      await supabase
        .from('servers')
        .update({
          status: 'error',
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', serverId);

      return new Response(
        JSON.stringify({
          success: false,
          accessible: false,
          port: server.supabase_port,
          url: testUrl,
          error: 'Connection timeout - port may be blocked by firewall',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error) {
    console.error('Test error:', error);
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
