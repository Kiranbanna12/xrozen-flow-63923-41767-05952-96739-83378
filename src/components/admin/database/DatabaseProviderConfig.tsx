import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Database, Loader2, Server, HardDrive, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { dbSwitcher, type DatabaseProvider } from "@/services/database-switcher.service";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DatabaseProviderConfigProps {
  currentProvider: string;
  onProviderChange: () => void;
}

export function DatabaseProviderConfig({ currentProvider, onProviderChange }: DatabaseProviderConfigProps) {
  const [selectedProvider, setSelectedProvider] = useState<DatabaseProvider>('sqlite');
  const [testing, setTesting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSupabaseConfig, setShowSupabaseConfig] = useState(false);
  const [targetProvider, setTargetProvider] = useState<DatabaseProvider>('sqlite');
  const [supabaseUrl, setSupabaseUrl] = useState(
    import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('custom_supabase_url') || ''
  );
  const [supabaseKey, setSupabaseKey] = useState(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || localStorage.getItem('custom_supabase_key') || ''
  );

  const providers: { value: DatabaseProvider; label: string; icon: any; description: string }[] = [
    {
      value: 'sqlite',
      label: 'SQLite (Internal)',
      icon: HardDrive,
      description: 'Local database stored on your server. Fast and simple.'
    },
    {
      value: 'supabase',
      label: 'Supabase (Cloud)',
      icon: Server,
      description: 'Cloud PostgreSQL database with real-time capabilities.'
    }
  ];

  useEffect(() => {
    loadCurrentProvider();
  }, []);

  const loadCurrentProvider = async () => {
    const provider = await dbSwitcher.getCurrentProvider();
    setSelectedProvider(provider);
  };

  const handleTestConnection = async (provider: DatabaseProvider) => {
    setTesting(true);
    try {
      const isConnected = await dbSwitcher.testConnection(provider);
      
      if (isConnected) {
        toast({
          title: "Connection Successful",
          description: `Successfully connected to ${provider}`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: `Could not connect to ${provider}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Could not test connection",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSwitchProvider = (provider: DatabaseProvider) => {
    if (provider === currentProvider) {
      toast({
        title: "Already Active",
        description: `${provider} is already the active database`,
      });
      return;
    }
    
    setTargetProvider(provider);
    
    // If switching to Supabase, show config dialog first
    if (provider === 'supabase') {
      setShowSupabaseConfig(true);
    } else {
      setShowConfirmDialog(true);
    }
  };

  const handleSupabaseConfigSubmit = () => {
    if (!supabaseUrl || !supabaseKey) {
      toast({
        title: "Missing Configuration",
        description: "Please provide both Supabase URL and Anon Key",
        variant: "destructive",
      });
      return;
    }
    
    setShowSupabaseConfig(false);
    setShowConfirmDialog(true);
  };

  const confirmSwitch = async () => {
    setSwitching(true);
    setShowConfirmDialog(false);
    
    try {
      const config = targetProvider === 'supabase' 
        ? { supabaseUrl, supabaseKey }
        : undefined;
        
      const result = await dbSwitcher.switchProvider(targetProvider, config);
      
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
        setSelectedProvider(targetProvider);
        onProviderChange();
        
        // Reload page to reinitialize Supabase client with new credentials
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast({
          title: "Switch Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to switch database",
        variant: "destructive",
      });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Database Provider Selection</CardTitle>
            <CardDescription>
              Switch between SQLite (internal) and Supabase (cloud) databases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {providers.map((provider) => {
                const Icon = provider.icon;
                const isActive = currentProvider === provider.value;
                const isSelected = selectedProvider === provider.value;
                
                return (
                  <Card 
                    key={provider.value}
                    className={`cursor-pointer transition-all ${
                      isActive
                        ? "ring-2 ring-primary shadow-lg" 
                        : "hover:border-primary/50 hover:shadow-md"
                    }`}
                    onClick={() => setSelectedProvider(provider.value)}
                  >
                    <CardHeader className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isActive ? 'bg-primary/10' : 'bg-muted'}`}>
                            <Icon className={`h-6 w-6 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{provider.label}</CardTitle>
                          </div>
                        </div>
                        {isActive && (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Active
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-sm">
                        {provider.description}
                      </CardDescription>
                      
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant={isActive ? "secondary" : "default"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSwitchProvider(provider.value);
                          }}
                          disabled={isActive || switching}
                          className="flex-1"
                        >
                          {switching ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Switching...
                            </>
                          ) : isActive ? (
                            "Currently Active"
                          ) : (
                            `Switch to ${provider.value === 'sqlite' ? 'SQLite' : 'Supabase'}`
                          )}
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestConnection(provider.value);
                          }}
                          disabled={testing}
                        >
                          {testing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Database className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Important Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-yellow-800 dark:text-yellow-200 space-y-2">
            <p>
              • <strong>SQLite</strong>: Data is stored locally on your server. Best for development and smaller applications.
            </p>
            <p>
              • <strong>Supabase</strong>: Cloud-hosted PostgreSQL database with real-time features, perfect for production and scalability.
            </p>
            <p>
              • Switching databases will change where your application reads and writes data.
            </p>
            <p>
              • Make sure you have migrated your data before switching in production!
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showSupabaseConfig} onOpenChange={setShowSupabaseConfig}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configure Supabase Connection</DialogTitle>
            <DialogDescription>
              Enter your Supabase project credentials to connect
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="supabase-url">Supabase URL</Label>
              <Input
                id="supabase-url"
                placeholder="https://your-project.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supabase-key">Supabase Anon Key</Label>
              <Input
                id="supabase-key"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                type="password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSupabaseConfig(false)}>
              Cancel
            </Button>
            <Button onClick={handleSupabaseConfigSubmit}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch Database Provider?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to switch from <strong>{currentProvider}</strong> to <strong>{targetProvider}</strong>.
              </p>
              <p className="text-yellow-600 dark:text-yellow-400">
                ⚠️ This will change where your application stores and retrieves data. Make sure you have backed up your data and migrated it to the target database if needed.
              </p>
              <p>Are you sure you want to continue?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitch}>
              Yes, Switch Database
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
