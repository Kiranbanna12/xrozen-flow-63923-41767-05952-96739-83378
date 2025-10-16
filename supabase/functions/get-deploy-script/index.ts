import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Generate deployment script
    const script = `#!/bin/bash
set -e

echo "================================================"
echo "Supabase VPS Deployment Script"
echo "================================================"

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

echo -e "\${GREEN}[1/7] Updating system packages...\${NC}"
apt-get update -y

echo -e "\${GREEN}[2/7] Installing Docker...\${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    echo "Docker already installed"
fi

echo -e "\${GREEN}[3/7] Installing Docker Compose...\${NC}"
if ! command -v docker compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    echo "Docker Compose already installed"
fi

echo -e "\${GREEN}[4/7] Configuring firewall for port 9000...\${NC}"
# Try different firewall tools
if command -v ufw &> /dev/null; then
    ufw allow 9000/tcp || true
    echo "UFW: Port 9000 opened"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=9000/tcp || true
    firewall-cmd --reload || true
    echo "Firewalld: Port 9000 opened"
elif command -v iptables &> /dev/null; then
    iptables -I INPUT -p tcp --dport 9000 -j ACCEPT || true
    echo "iptables: Port 9000 opened"
fi

echo -e "\${GREEN}[5/7] Setting up Supabase...\${NC}"
cd /opt
rm -rf supabase
git clone --depth 1 https://github.com/supabase/supabase
cd /opt/supabase/docker

echo -e "\${GREEN}[6/7] Configuring Supabase for port 9000...\${NC}"
cp .env.example .env

# Configure to bind to all interfaces and use port 9000
sed -i 's/KONG_HTTP_HOST=127.0.0.1/KONG_HTTP_HOST=0.0.0.0/g' .env
sed -i 's/KONG_HTTPS_HOST=127.0.0.1/KONG_HTTPS_HOST=0.0.0.0/g' .env
sed -i 's/KONG_HTTP_PORT=8000/KONG_HTTP_PORT=9000/g' .env

echo -e "\${GREEN}[7/7] Starting Supabase containers...\${NC}"
docker compose up -d

echo ""
echo -e "\${GREEN}Waiting for services to start...\${NC}"
sleep 15

echo ""
echo -e "\${GREEN}================================================\${NC}"
echo -e "\${GREEN}Deployment completed successfully!\${NC}"
echo -e "\${GREEN}================================================\${NC}"
echo ""
echo "Supabase Studio URL: http://\$(curl -s ifconfig.me):9000"
echo ""

# Register server with the app
echo -e "\${YELLOW}Registering server with app...\${NC}"
curl -X POST "${supabaseUrl}/functions/v1/register-server" \\
  -H "Content-Type: application/json" \\
  -d "{\\"serverId\\": \\"${serverId}\\", \\"status\\": \\"online\\", \\"supabasePort\\": 9000}" \\
  || echo -e "\${RED}Failed to register server automatically. Please refresh your app.\${NC}"

echo ""
echo -e "\${GREEN}Setup complete! Your Supabase instance is now running.\${NC}"
`;

    return new Response(
      JSON.stringify({
        success: true,
        script: script,
        serverId: serverId,
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
