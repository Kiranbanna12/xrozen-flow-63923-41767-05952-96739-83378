import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2, Server, Globe, Loader2, AlertCircle, Terminal, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase-helper";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ServerCardProps {
  server: {
    id: string;
    ip_address: string;
    ssh_username: string;
    ssh_port: number;
    supabase_port: number;
    status: string;
    created_at: string;
    last_checked_at: string | null;
  };
  onServerRemoved: () => void;
}

export const ServerCard = ({ server, onServerRemoved }: ServerCardProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showFixDialog, setShowFixDialog] = useState(false);
  const [fixScript, setFixScript] = useState("");

  const handleTestPort = async () => {
    setIsTesting(true);
    try {
      const { data, error } = await getSupabaseClient().functions.invoke(
        "test-port",
        {
          body: { serverId: server.id },
        }
      );

      if (error) throw error;

      if (data.accessible) {
        toast.success(`Port ${data.port} is accessible!`);
      } else {
        toast.error(`Port ${data.port} is blocked. Click "Fix Connection Issues" to resolve.`);
      }
      
      onServerRemoved(); // Refresh data
    } catch (error: any) {
      console.error("Test error:", error);
      toast.error("Failed to test connection");
    } finally {
      setIsTesting(false);
    }
  };

  const handleGetFixScript = async () => {
    try {
      const { data, error } = await getSupabaseClient().functions.invoke(
        "fix-firewall",
        {
          body: { serverId: server.id },
        }
      );

      if (error || !data.success) {
        throw new Error(error?.message || "Failed to generate fix script");
      }

      setFixScript(data.script);
      setShowFixDialog(true);
      toast.success("Fix script generated!");
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to generate fix script");
    }
  };

  const copyFixScript = () => {
    navigator.clipboard.writeText(fixScript);
    toast.success("Script copied! Run it on your VPS to fix connection issues.");
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("servers")
        .delete()
        .eq("id", server.id);

      if (error) throw error;

      toast.success("Server removed successfully");
      onServerRemoved();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to remove server");
    } finally {
      setIsDeleting(false);
    }
  };

  const statusConfig = {
    online: {
      color: "bg-green-500",
      text: "Online",
      variant: "default" as const,
    },
    offline: {
      color: "bg-gray-500",
      text: "Offline",
      variant: "secondary" as const,
    },
    deploying: {
      color: "bg-blue-500",
      text: "Deploying",
      variant: "default" as const,
    },
    pending: {
      color: "bg-yellow-500",
      text: "Pending - Run Script",
      variant: "secondary" as const,
    },
    error: {
      color: "bg-red-500",
      text: "Error",
      variant: "destructive" as const,
    },
  };

  const handleGetDeployScript = async () => {
    try {
      const { data, error } = await getSupabaseClient().functions.invoke(
        "get-deploy-script",
        {
          body: { serverId: server.id },
        }
      );

      if (error || !data.success) {
        throw new Error("Failed to generate script");
      }

      // Download script
      const blob = new Blob([data.script], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deploy-${server.ip_address}.sh`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Script downloaded! Run it on your VPS to deploy Supabase.");
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to get script");
    }
  };

  const currentStatus = statusConfig[server.status as keyof typeof statusConfig] || statusConfig.offline;
  const supabaseUrl = `http://${server.ip_address}:${server.supabase_port || 9000}`;
  const isOnline = server.status === 'online';

  return (
    <>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/70 transition-all">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {server.ip_address}
                  <Badge variant={currentStatus.variant} className="ml-2">
                    <div className={`h-2 w-2 rounded-full ${currentStatus.color} mr-1.5`} />
                    {currentStatus.text}
                  </Badge>
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Globe className="h-3 w-3" />
                  Port {server.supabase_port || 9000}
                </CardDescription>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isDeleting}
                  className="hover:bg-destructive/10 hover:text-destructive"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Server</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove this server? This will only remove it from the dashboard.
                    The Supabase instance will continue running on your VPS.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground space-y-1">
              <div>SSH: {server.ssh_username}@{server.ip_address}:{server.ssh_port}</div>
              <div>Added {formatDistanceToNow(new Date(server.created_at))} ago</div>
              {server.last_checked_at && (
                <div>Last checked: {new Date(server.last_checked_at).toLocaleString()}</div>
              )}
            </div>

            {server.status === 'pending' && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div className="flex-1 text-sm space-y-2">
                  <p className="font-medium text-yellow-600">Deployment Script Ready</p>
                  <p className="text-muted-foreground">SSH into your VPS and run the downloaded script to deploy Supabase.</p>
                  <Button onClick={handleGetDeployScript} size="sm" variant="outline">
                    Download Script Again
                  </Button>
                </div>
              </div>
            )}

            {server.status === 'deploying' && (
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Loader2 className="h-4 w-4 text-blue-500 mt-0.5 animate-spin" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-blue-500">Deployment in Progress</p>
                  <p className="text-muted-foreground">Wait for the script to complete on your VPS. Click "Test Port" to check status.</p>
                </div>
              </div>
            )}

            {server.status === 'error' && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-destructive">Deployment Failed</p>
                  <p className="text-muted-foreground">Check deployment logs on VPS or try again. Port {server.supabase_port || 9000} may be blocked.</p>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => window.open(supabaseUrl, '_blank')}
                disabled={!isOnline}
                className="flex-1"
                variant={isOnline ? "default" : "secondary"}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Supabase Studio
              </Button>
              
              <Button
                onClick={handleTestPort}
                disabled={isTesting}
                variant="outline"
                size="icon"
                title="Test Port Connection"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>

              <Button
                onClick={handleGetFixScript}
                variant="outline"
                size="icon"
                title="Fix Connection Issues"
              >
                <Terminal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showFixDialog} onOpenChange={setShowFixDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              Fix Connection Issues
            </DialogTitle>
            <DialogDescription>
              Run this script on your VPS to fix firewall and connection issues
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg text-sm space-y-2">
              <p>1. SSH into your VPS: <code className="bg-background px-2 py-1 rounded">ssh {server.ssh_username}@{server.ip_address}</code></p>
              <p>2. Copy and run the script below</p>
              <p>3. Wait for completion, then click "Test Port" button</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fix Script</Label>
                <Button onClick={copyFixScript} variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Copy Script
                </Button>
              </div>
              <Textarea
                value={fixScript}
                readOnly
                className="font-mono text-xs h-[400px]"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
