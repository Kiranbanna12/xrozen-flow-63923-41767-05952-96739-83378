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

    const { serverId } = await req.json();

    // Get server details
    const { data: server, error } = await supabase
      .from('servers')
      .select('*')
      .eq('id', serverId)
      .single();

    if (error || !server) {
      throw new Error('Server not found');
    }

    const port = server.supabase_port || 9000;

    // Generate firewall fix script
    const fixScript = `#!/bin/bash
set -e

echo "================================================"
echo "Fixing Firewall and Connection Issues"
echo "================================================"

GREEN='\\033[0;32m'
RED='\\033[0;31m'
NC='\\033[0m'

echo -e "\${GREEN}[1/5] Checking Docker containers...\${NC}"
docker ps | grep supabase

echo -e "\${GREEN}[2/5] Opening firewall ports...\${NC}"
if command -v ufw &> /dev/null; then
    echo "Using UFW firewall..."
    sudo ufw allow ${port}/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw allow 54321/tcp
    sudo ufw --force enable
    sudo ufw reload
    sudo ufw status
    echo "✓ UFW configured"
elif command -v firewall-cmd &> /dev/null; then
    echo "Using firewalld..."
    sudo firewall-cmd --permanent --add-port=${port}/tcp
    sudo firewall-cmd --permanent --add-port=80/tcp
    sudo firewall-cmd --permanent --add-port=443/tcp
    sudo firewall-cmd --permanent --add-port=54321/tcp
    sudo firewall-cmd --reload
    sudo firewall-cmd --list-ports
    echo "✓ Firewalld configured"
elif command -v iptables &> /dev/null; then
    echo "Using iptables..."
    sudo iptables -I INPUT -p tcp --dport ${port} -j ACCEPT
    sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
    sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
    sudo iptables -I INPUT -p tcp --dport 54321 -j ACCEPT
    sudo iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
    echo "✓ Iptables configured"
else
    echo -e "\${RED}No firewall detected\${NC}"
fi

echo -e "\${GREEN}[3/5] Checking Docker network binding...\${NC}"
cd /opt/supabase/docker

# Fix docker-compose to bind to 0.0.0.0
if grep -q "127.0.0.1:${port}" docker-compose.yml; then
    echo "Fixing localhost binding to 0.0.0.0..."
    sed -i 's/127.0.0.1:/0.0.0.0:/g' docker-compose.yml
    docker-compose restart
    echo "✓ Docker binding fixed"
else
    echo "✓ Docker already bound to 0.0.0.0"
fi

echo -e "\${GREEN}[4/5] Verifying port ${port}...\${NC}"
netstat -tulpn | grep :${port} || ss -tulpn | grep :${port}

echo -e "\${GREEN}[5/5] Testing local connectivity...\${NC}"
curl -I -m 5 http://localhost:${port} || echo "Local test timeout"
curl -I -m 5 http://0.0.0.0:${port} || echo "0.0.0.0 test timeout"

echo ""
echo -e "\${GREEN}================================================\${NC}"
echo -e "\${GREEN}Firewall fix complete!\${NC}"
echo -e "\${GREEN}================================================\${NC}"
echo ""
echo "Supabase should now be accessible at:"
echo "  http://${server.ip_address}:${port}"
echo ""
echo "If still not accessible, check your VPS provider's"
echo "firewall/security groups (AWS, DigitalOcean, etc.)"
echo "and ensure port ${port} is allowed."
`;

    return new Response(
      JSON.stringify({
        success: true,
        script: fixScript,
        port: port,
        ipAddress: server.ip_address,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Script generation error:', error);
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
