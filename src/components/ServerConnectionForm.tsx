import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ServerCog } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase-helper";

interface Server {
  id: string;
  ip_address: string;
  ssh_username: string;
  ssh_password: string;
  ssh_port: number;
  status: string;
}

interface ServerConnectionFormProps {
  onServerAdded: () => void;
}

export const ServerConnectionForm = ({ onServerAdded }: ServerConnectionFormProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [formData, setFormData] = useState({
    ipAddress: "",
    sshUsername: "root",
    sshPassword: "",
    sshPort: "22",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);

    try {
      const supabase = getSupabaseClient();
      
      // Insert the server record
      const { data: server, error: insertError } = await supabase
        .from("servers")
        .insert({
          ip_address: formData.ipAddress,
          ssh_username: formData.sshUsername,
          ssh_password: formData.sshPassword,
          ssh_port: parseInt(formData.sshPort),
          status: "pending",
          supabase_port: 9000,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!server) throw new Error("Failed to create server record");

      // Get deployment script
      const { data, error: scriptError } = await supabase.functions.invoke(
        "get-deploy-script",
        {
          body: { serverId: server.id },
        }
      );

      if (scriptError || !data.success) {
        throw new Error("Failed to generate deployment script");
      }

      // Download script as a file
      const blob = new Blob([data.script], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deploy-supabase-${formData.ipAddress}.sh`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Server added! Download the deployment script and run it on your VPS.");
      
      // Reset form
      setFormData({
        ipAddress: "",
        sshUsername: "root",
        sshPassword: "",
        sshPort: "22",
      });

      onServerAdded();
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to add server");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ServerCog className="h-5 w-5 text-primary" />
          Connect New Server
        </CardTitle>
        <CardDescription>
          Add your VPS server details to deploy Supabase
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ipAddress">VPS IP Address</Label>
            <Input
              id="ipAddress"
              placeholder="192.168.1.100"
              value={formData.ipAddress}
              onChange={(e) =>
                setFormData({ ...formData, ipAddress: e.target.value })
              }
              required
              disabled={isConnecting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sshUsername">SSH Username</Label>
              <Input
                id="sshUsername"
                value={formData.sshUsername}
                onChange={(e) =>
                  setFormData({ ...formData, sshUsername: e.target.value })
                }
                required
                disabled={isConnecting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sshPort">SSH Port</Label>
              <Input
                id="sshPort"
                type="number"
                value={formData.sshPort}
                onChange={(e) =>
                  setFormData({ ...formData, sshPort: e.target.value })
                }
                required
                disabled={isConnecting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sshPassword">SSH Password</Label>
            <Input
              id="sshPassword"
              type="password"
              placeholder="••••••••"
              value={formData.sshPassword}
              onChange={(e) =>
                setFormData({ ...formData, sshPassword: e.target.value })
              }
              required
              disabled={isConnecting}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Script...
              </>
            ) : (
              "Get Deployment Script"
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground text-center mt-2">
            You'll download a script to run on your VPS
          </p>
        </form>
      </CardContent>
    </Card>
  );
};
