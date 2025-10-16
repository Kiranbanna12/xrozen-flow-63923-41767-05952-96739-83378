import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Database, Activity, HardDrive, Clock } from "lucide-react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DatabaseProviderConfig } from "@/components/admin/database/DatabaseProviderConfig";
import { MigrationWizard } from "@/components/admin/database/MigrationWizard";
import { DatabaseMonitoring } from "@/components/admin/database/DatabaseMonitoring";
import { dbSwitcher } from "@/services/database-switcher.service";
import { toast } from "@/hooks/use-toast";

export default function AdminDatabase() {
  const [currentProvider, setCurrentProvider] = useState<string>("sqlite");
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "checking">("checking");
  const [databaseStats, setDatabaseStats] = useState({
    totalTables: 11,
    totalRecords: 0,
    storageUsed: "0 MB",
    lastBackup: null as Date | null,
  });

  useEffect(() => {
    checkDatabaseStatus();
    loadDatabaseStats();
  }, []);

  const checkDatabaseStatus = async () => {
    setConnectionStatus("checking");
    try {
      // Get current provider from database switcher service
      const provider = await dbSwitcher.getCurrentProvider();
      setCurrentProvider(provider);
      
      // Test connection
      const isConnected = await dbSwitcher.testConnection(provider);
      setConnectionStatus(isConnected ? "connected" : "disconnected");
    } catch (error) {
      console.error("Connection check failed:", error);
      setConnectionStatus("disconnected");
      toast({
        title: "Connection Failed",
        description: "Could not connect to database",
        variant: "destructive",
      });
    }
  };

  const loadDatabaseStats = async () => {
    try {
      setDatabaseStats({
        totalTables: 14,
        totalRecords: 0,
        storageUsed: "0 MB",
        lastBackup: null,
      });
    } catch (error) {
      console.error("Failed to load database stats:", error);
      setDatabaseStats({
        totalTables: 14,
        totalRecords: 0,
        storageUsed: "0 MB",
        lastBackup: null,
      });
    }
  };

  return (
    <AdminLayout title="Database Management" description="Manage database providers, migrate data, and monitor performance">
      <div className="space-y-6">
        {/* Current Database Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Current Database Status
              </span>
              <Badge variant={connectionStatus === "connected" ? "default" : "destructive"}>
                {connectionStatus === "connected" ? (
                  <CheckCircle className="h-4 w-4 mr-1" />
                ) : (
                  <AlertCircle className="h-4 w-4 mr-1" />
                )}
                {connectionStatus === "checking" ? "Checking..." : connectionStatus}
              </Badge>
            </CardTitle>
            <CardDescription>
              Active provider and real-time statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Active Provider */}
              <div className="p-4 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Database className="h-4 w-4" />
                  Active Provider
                </div>
                <div className="text-2xl font-bold capitalize">{currentProvider}</div>
              </div>

              {/* Total Records */}
              <div className="p-4 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <HardDrive className="h-4 w-4" />
                  Total Records
                </div>
                <div className="text-2xl font-bold">{databaseStats.totalRecords.toLocaleString()}</div>
              </div>

              {/* Storage Used */}
              <div className="p-4 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Activity className="h-4 w-4" />
                  Storage Used
                </div>
                <div className="text-2xl font-bold">{databaseStats.storageUsed}</div>
              </div>

              {/* Last Backup */}
              <div className="p-4 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  Last Backup
                </div>
                <div className="text-2xl font-bold">
                  {databaseStats.lastBackup ? 
                    new Date(databaseStats.lastBackup).toLocaleDateString() : 
                    "Never"
                  }
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button onClick={checkDatabaseStatus} variant="outline" size="sm">
                Refresh Status
              </Button>
              <Button onClick={loadDatabaseStats} variant="outline" size="sm">
                Reload Statistics
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Tabs defaultValue="providers" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="providers">Database Providers</TabsTrigger>
            <TabsTrigger value="migration">Migration Wizard</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring & Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="space-y-4">
            <DatabaseProviderConfig 
              currentProvider={currentProvider}
              onProviderChange={() => {
                checkDatabaseStatus();
                loadDatabaseStats();
              }}
            />
          </TabsContent>

          <TabsContent value="migration" className="space-y-4">
            <MigrationWizard 
              currentProvider={currentProvider}
              onMigrationComplete={() => {
                checkDatabaseStatus();
                loadDatabaseStats();
              }}
            />
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            <DatabaseMonitoring currentProvider={currentProvider} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
