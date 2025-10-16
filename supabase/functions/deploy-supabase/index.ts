import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Complete automatic deployment script
const DEPLOYMENT_SCRIPT = `#!/bin/bash
set -e

echo "=== VPS Supabase Auto-Deployment ==="
echo "Starting automatic deployment..."

echo "STEP 1: System Check"
cat /etc/os-release || true
OS_TYPE=$(grep -oP '(?<=^ID=).+' /etc/os-release 2>/dev/null | tr -d '"' || echo "unknown")
echo "OS: $OS_TYPE"

echo "STEP 2: Install Docker"
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl start docker || service docker start
    systemctl enable docker || true
fi

if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

docker --version
docker compose version

echo "STEP 3: Setup Supabase"
cd /opt
rm -rf supabase
git clone --depth 1 https://github.com/supabase/supabase
cd /opt/supabase/docker

JWT_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 16)

cp .env.example .env
sed -i "s/your-super-secret-jwt-token-with-at-least-32-characters-long/$JWT_SECRET/g" .env
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/g" .env

echo "STEP 4: Configure Network (0.0.0.0)"
sed -i 's/127.0.0.1:/0.0.0.0:/g' docker-compose.yml

echo "STEP 5: Start Supabase"
docker compose up -d

echo "Waiting for services..."
sleep 30

echo "STEP 6: Detect Port"
SUPABASE_PORT=$(docker ps | grep supabase-studio | grep -oP '\\d+(?=->3000)' | head -1 || echo "3000")
echo "PORT:$SUPABASE_PORT"

echo "STEP 7: Configure Firewall"
if command -v ufw &> /dev/null; then
    ufw --force enable
    ufw allow $SUPABASE_PORT/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 54321/tcp
    ufw reload
elif command -v firewall-cmd &> /dev/null; then
    systemctl start firewalld || true
    firewall-cmd --permanent --add-port=$SUPABASE_PORT/tcp
    firewall-cmd --permanent --add-port=80/tcp
    firewall-cmd --permanent --add-port=443/tcp
    firewall-cmd --permanent --add-port=54321/tcp
    firewall-cmd --reload
elif command -v iptables &> /dev/null; then
    iptables -I INPUT -p tcp --dport $SUPABASE_PORT -j ACCEPT
    iptables -I INPUT -p tcp --dport 80 -j ACCEPT
    iptables -I INPUT -p tcp --dport 443 -j ACCEPT
    iptables -I INPUT -p tcp --dport 54321 -j ACCEPT
fi

echo "STEP 8: Verify"
docker ps | grep supabase
netstat -tulpn 2>/dev/null | grep $SUPABASE_PORT || ss -tulpn | grep $SUPABASE_PORT || true

echo "SUCCESS:$SUPABASE_PORT"
`;

// Execute deployment via SSH
async function executeDeployment(
  ipAddress: string,
  sshPort: number,
  username: string,
  password: string
): Promise<{ success: boolean; port: number; output: string }> {
  
  try {
    console.log(`📡 Connecting to ${ipAddress}...`);
    
    // Encode password for SSH
    const encoder = new TextEncoder();
    const scriptBytes = encoder.encode(DEPLOYMENT_SCRIPT);
    
    // Create deployment command
    const sshCmd = `sshpass -p '${password}' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p ${sshPort} ${username}@${ipAddress} 'bash -s'`;
    
    // Execute via shell
    const process = new Deno.Command("sh", {
      args: ["-c", sshCmd],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });
    
    const child = process.spawn();
    
    // Write script to stdin
    const writer = child.stdin.getWriter();
    await writer.write(scriptBytes);
    await writer.close();
    
    // Get output
    const output = await child.output();
    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);
    
    console.log("📋 Deployment output:");
    console.log(stdout);
    
    if (stderr) {
      console.log("⚠️ Stderr:");
      console.log(stderr);
    }
    
    // Extract port
    let detectedPort = 3000;
    const portMatch = stdout.match(/PORT:(\d+)/);
    if (portMatch && portMatch[1]) {
      detectedPort = parseInt(portMatch[1]);
    }
    
    const success = stdout.includes('SUCCESS:') && output.success;
    
    return {
      success,
      port: detectedPort,
      output: stdout + '\n' + stderr
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Deployment error: ${errorMessage}`);
    return {
      success: false,
      port: 3000,
      output: `Error: ${errorMessage}`
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { serverId, ipAddress, sshUsername, sshPassword, sshPort } = await req.json();

    console.log(`🚀 Starting deployment for ${ipAddress}`);

    // Update status immediately
    await supabase
      .from('servers')
      .update({ status: 'deploying' })
      .eq('id', serverId);

    // Execute deployment (don't await - run in background)
    Promise.resolve().then(async () => {
      try {
        const result = await executeDeployment(
          ipAddress,
          sshPort,
          sshUsername,
          sshPassword
        );
        
        if (result.success) {
          await supabase
            .from('servers')
            .update({
              status: 'online',
              supabase_port: result.port,
              last_checked_at: new Date().toISOString(),
            })
            .eq('id', serverId);
          console.log(`✅ Deployment complete: ${ipAddress}:${result.port}`);
        } else {
          await supabase
            .from('servers')
            .update({ status: 'error' })
            .eq('id', serverId);
          console.error(`❌ Deployment failed for ${ipAddress}`);
        }
      } catch (error) {
        console.error('Background error:', error);
        await supabase
          .from('servers')
          .update({ status: 'error' })
          .eq('id', serverId);
      }
    });

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Deployment started! This will take 5-10 minutes.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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
