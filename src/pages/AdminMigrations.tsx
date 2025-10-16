import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileText, Play, RotateCcw, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { toast } from "sonner";

interface Migration {
  id: string;
  name: string;
  status: 'pending' | 'applied' | 'failed';
  appliedAt?: Date;
  rollbackAt?: Date;
  description: string;
}

export default function AdminMigrations() {
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    loadMigrations();
  }, []);

  const loadMigrations = async () => {
    try {
      setLoading(true);
      
      // Mock migration data - in real implementation, this would come from database
      const mockMigrations: Migration[] = [
        {
          id: "001",
          name: "001_initial_schema",
          status: "applied",
          appliedAt: new Date("2024-01-15"),
          description: "Initial database schema creation"
        },
        {
          id: "002", 
          name: "002_add_user_roles",
          status: "applied",
          appliedAt: new Date("2024-01-20"),
          description: "Add user roles and permissions system"
        },
        {
          id: "003",
          name: "003_project_enhancements",
          status: "applied", 
          appliedAt: new Date("2024-02-01"),
          description: "Enhance project management features"
        },
        {
          id: "004",
          name: "004_notification_system",
          status: "pending",
          description: "Add notification system tables"
        },
        {
          id: "005",
          name: "005_analytics_tables",
          status: "pending",
          description: "Create analytics and reporting tables"
        }
      ];

      setMigrations(mockMigrations);
    } catch (error) {
      console.error("Error loading migrations:", error);
      toast.error("Failed to load migrations");
    } finally {
      setLoading(false);
    }
  };

  const applyMigration = async (migrationId: string) => {
    try {
      setApplying(true);
      
      // Simulate migration application
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setMigrations(prev => prev.map(m => 
        m.id === migrationId 
          ? { ...m, status: 'applied' as const, appliedAt: new Date() }
          : m
      ));
      
      toast.success(`Migration ${migrationId} applied successfully`);
    } catch (error) {
      console.error("Migration application error:", error);
      toast.error("Failed to apply migration");
    } finally {
      setApplying(false);
    }
  };

  const rollbackMigration = async (migrationId: string) => {
    try {
      setApplying(true);
      
      // Simulate migration rollback
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setMigrations(prev => prev.map(m => 
        m.id === migrationId 
          ? { ...m, status: 'pending' as const, rollbackAt: new Date() }
          : m
      ));
      
      toast.success(`Migration ${migrationId} rolled back successfully`);
    } catch (error) {
      console.error("Migration rollback error:", error);
      toast.error("Failed to rollback migration");
    } finally {
      setApplying(false);
    }
  };

  const applyAllPending = async () => {
    const pendingMigrations = migrations.filter(m => m.status === 'pending');
    
    for (const migration of pendingMigrations) {
      await applyMigration(migration.id);
    }
  };

  const getStatusIcon = (status: Migration['status']) => {
    switch (status) {
      case 'applied':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: Migration['status']) => {
    switch (status) {
      case 'applied':
        return <Badge variant="default" className="bg-green-600">Applied</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const appliedCount = migrations.filter(m => m.status === 'applied').length;
  const pendingCount = migrations.filter(m => m.status === 'pending').length;
  const totalCount = migrations.length;

  if (loading) {
    return (
      <AdminLayout title="Migration Manager" description="Manage database migrations and schema changes">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Migration Manager" description="Manage database migrations and schema changes">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Migration Manager</h1>
            <p className="text-muted-foreground">Manage database migrations and schema changes</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadMigrations}>
              <FileText className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {pendingCount > 0 && (
              <Button onClick={applyAllPending} disabled={applying}>
                <Play className="mr-2 h-4 w-4" />
                Apply All Pending
              </Button>
            )}
          </div>
        </div>

        {/* Migration Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Migration Progress</CardTitle>
            <CardDescription>Overall migration status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Applied Migrations</span>
                <span className="text-sm text-muted-foreground">{appliedCount} / {totalCount}</span>
              </div>
              <Progress value={(appliedCount / totalCount) * 100} className="h-2" />
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">{appliedCount}</div>
                  <div className="text-sm text-muted-foreground">Applied</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-muted-foreground">{totalCount}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Migration List */}
        <Card>
          <CardHeader>
            <CardTitle>Available Migrations</CardTitle>
            <CardDescription>List of all database migrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {migrations.map((migration) => (
                <div key={migration.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(migration.status)}
                    <div>
                      <div className="font-medium">{migration.name}</div>
                      <div className="text-sm text-muted-foreground">{migration.description}</div>
                      {migration.appliedAt && (
                        <div className="text-xs text-muted-foreground">
                          Applied: {migration.appliedAt.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(migration.status)}
                    {migration.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => applyMigration(migration.id)}
                        disabled={applying}
                      >
                        <Play className="mr-1 h-3 w-3" />
                        Apply
                      </Button>
                    )}
                    {migration.status === 'applied' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rollbackMigration(migration.id)}
                        disabled={applying}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Rollback
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Migration Guidelines */}
        <Card>
          <CardHeader>
            <CardTitle>Migration Guidelines</CardTitle>
            <CardDescription>Best practices for database migrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>Always backup your database before applying migrations</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>Test migrations in a development environment first</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>Apply migrations during low-traffic periods</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <span>Keep migration files small and focused</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
