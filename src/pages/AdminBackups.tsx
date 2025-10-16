import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { HardDrive, Download, Upload, Trash2, Calendar, FileText } from "lucide-react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { toast } from "sonner";

interface Backup {
  id: string;
  name: string;
  size: number;
  createdAt: Date;
  status: 'completed' | 'in_progress' | 'failed';
  type: 'manual' | 'automatic';
}

export default function AdminBackups() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      setLoading(true);
      
      // Mock backup data - in real implementation, this would come from database
      const mockBackups: Backup[] = [
        {
          id: "1",
          name: "backup_2024_01_15_10_30_00.db",
          size: 15728640, // ~15MB
          createdAt: new Date("2024-01-15T10:30:00"),
          status: "completed",
          type: "automatic"
        },
        {
          id: "2", 
          name: "backup_2024_01_14_10_30_00.db",
          size: 15204352, // ~14.5MB
          createdAt: new Date("2024-01-14T10:30:00"),
          status: "completed",
          type: "automatic"
        },
        {
          id: "3",
          name: "manual_backup_2024_01_13_15_45_00.db",
          size: 15073280, // ~14.4MB
          createdAt: new Date("2024-01-13T15:45:00"),
          status: "completed",
          type: "manual"
        },
        {
          id: "4",
          name: "backup_2024_01_12_10_30_00.db",
          size: 14876672, // ~14.2MB
          createdAt: new Date("2024-01-12T10:30:00"),
          status: "failed",
          type: "automatic"
        }
      ];

      setBackups(mockBackups);
    } catch (error) {
      console.error("Error loading backups:", error);
      toast.error("Failed to load backups");
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    try {
      setCreating(true);
      
      // Simulate backup creation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const newBackup: Backup = {
        id: Date.now().toString(),
        name: `manual_backup_${new Date().toISOString().replace(/[:.]/g, '_').slice(0, 19)}.db`,
        size: Math.floor(Math.random() * 20000000) + 10000000, // 10-30MB
        createdAt: new Date(),
        status: "completed",
        type: "manual"
      };
      
      setBackups(prev => [newBackup, ...prev]);
      toast.success("Backup created successfully");
    } catch (error) {
      console.error("Backup creation error:", error);
      toast.error("Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const downloadBackup = (backup: Backup) => {
    // Simulate download
    toast.success(`Downloading ${backup.name}...`);
  };

  const deleteBackup = async (backupId: string) => {
    try {
      setBackups(prev => prev.filter(b => b.id !== backupId));
      toast.success("Backup deleted successfully");
    } catch (error) {
      console.error("Backup deletion error:", error);
      toast.error("Failed to delete backup");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getStatusBadge = (status: Backup['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="outline">In Progress</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  const getTypeBadge = (type: Backup['type']) => {
    return type === 'manual' 
      ? <Badge variant="outline">Manual</Badge>
      : <Badge variant="secondary">Automatic</Badge>;
  };

  const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
  const completedBackups = backups.filter(b => b.status === 'completed').length;

  if (loading) {
    return (
      <AdminLayout title="Backup Manager" description="Manage database backups and restore operations">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Backup Manager" description="Manage database backups and restore operations">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Backup Manager</h1>
            <p className="text-muted-foreground">Manage database backups and restore operations</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadBackups}>
              <HardDrive className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={createBackup} disabled={creating}>
              <HardDrive className="mr-2 h-4 w-4" />
              {creating ? "Creating..." : "Create Backup"}
            </Button>
          </div>
        </div>

        {/* Backup Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Backups</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{backups.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <FileText className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{completedBackups}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Size</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatSize(totalSize)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Backup</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {backups.length > 0 
                  ? new Date(Math.max(...backups.map(b => b.createdAt.getTime()))).toLocaleDateString()
                  : "Never"
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Backup List */}
        <Card>
          <CardHeader>
            <CardTitle>Available Backups</CardTitle>
            <CardDescription>List of all database backups</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {backups.map((backup) => (
                <div key={backup.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <HardDrive className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">{backup.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatSize(backup.size)} • {backup.createdAt.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(backup.status)}
                    {getTypeBadge(backup.type)}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadBackup(backup)}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteBackup(backup.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Backup Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Backup Settings</CardTitle>
            <CardDescription>Configure automatic backup settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Automatic Backups</div>
                  <div className="text-sm text-muted-foreground">Daily backups at 10:30 AM</div>
                </div>
                <Badge variant="default" className="bg-green-600">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Retention Policy</div>
                  <div className="text-sm text-muted-foreground">Keep backups for 30 days</div>
                </div>
                <Badge variant="outline">30 days</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Compression</div>
                  <div className="text-sm text-muted-foreground">GZIP compression enabled</div>
                </div>
                <Badge variant="default" className="bg-green-600">Enabled</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Restore Section */}
        <Card>
          <CardHeader>
            <CardTitle>Restore Database</CardTitle>
            <CardDescription>Restore database from a backup file</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Backup File
                </Button>
                <div className="text-sm text-muted-foreground">
                  Select a .db backup file to restore
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <strong>Warning:</strong> Restoring from a backup will replace all current data. 
                Make sure to create a backup before proceeding.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
