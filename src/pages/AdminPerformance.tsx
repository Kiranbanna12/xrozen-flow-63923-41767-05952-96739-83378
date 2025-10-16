import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Cpu, HardDrive, Zap, RefreshCw, TrendingUp } from "lucide-react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { toast } from "sonner";

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
}

interface QueryPerformance {
  query: string;
  avgTime: number;
  count: number;
  lastExecuted: Date;
}

export default function AdminPerformance() {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [slowQueries, setSlowQueries] = useState<QueryPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    loadPerformanceData();
    const interval = setInterval(loadPerformanceData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      
      // Mock performance data
      const mockMetrics: PerformanceMetric[] = [
        {
          name: "Database Size",
          value: 45.2,
          unit: "MB",
          status: "good",
          trend: "up"
        },
        {
          name: "Query Response Time",
          value: 12.5,
          unit: "ms",
          status: "good",
          trend: "stable"
        },
        {
          name: "Active Connections",
          value: 8,
          unit: "connections",
          status: "good",
          trend: "stable"
        },
        {
          name: "Cache Hit Ratio",
          value: 94.2,
          unit: "%",
          status: "good",
          trend: "up"
        },
        {
          name: "Disk I/O",
          value: 156.7,
          unit: "IOPS",
          status: "warning",
          trend: "up"
        },
        {
          name: "Memory Usage",
          value: 78.5,
          unit: "%",
          status: "warning",
          trend: "up"
        }
      ];

      const mockSlowQueries: QueryPerformance[] = [
        {
          query: "SELECT * FROM projects WHERE status = 'active'",
          avgTime: 245.6,
          count: 156,
          lastExecuted: new Date(Date.now() - 300000)
        },
        {
          query: "SELECT COUNT(*) FROM profiles WHERE created_at > ?",
          avgTime: 189.3,
          count: 89,
          lastExecuted: new Date(Date.now() - 600000)
        },
        {
          query: "SELECT * FROM messages ORDER BY created_at DESC LIMIT 100",
          avgTime: 167.8,
          count: 234,
          lastExecuted: new Date(Date.now() - 120000)
        }
      ];

      setMetrics(mockMetrics);
      setSlowQueries(mockSlowQueries);
    } catch (error) {
      console.error("Error loading performance data:", error);
      toast.error("Failed to load performance data");
    } finally {
      setLoading(false);
    }
  };

  const optimizeDatabase = async () => {
    try {
      setOptimizing(true);
      
      // Simulate optimization process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      toast.success("Database optimization completed successfully");
      
      // Refresh data after optimization
      await loadPerformanceData();
    } catch (error) {
      console.error("Optimization error:", error);
      toast.error("Failed to optimize database");
    } finally {
      setOptimizing(false);
    }
  };

  const getStatusColor = (status: PerformanceMetric['status']) => {
    switch (status) {
      case 'good':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
    }
  };

  const getStatusBadge = (status: PerformanceMetric['status']) => {
    switch (status) {
      case 'good':
        return <Badge variant="default" className="bg-green-600">Good</Badge>;
      case 'warning':
        return <Badge variant="outline" className="border-yellow-600 text-yellow-600">Warning</Badge>;
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
    }
  };

  const getTrendIcon = (trend: PerformanceMetric['trend']) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />;
      case 'stable':
        return <Activity className="h-4 w-4 text-primary" />;
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Performance Monitor" description="Monitor database performance and optimize operations">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Performance Monitor" description="Monitor database performance and optimize operations">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Performance Monitor</h1>
            <p className="text-muted-foreground">Monitor database performance and optimize operations</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadPerformanceData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={optimizeDatabase} disabled={optimizing}>
              <Zap className="mr-2 h-4 w-4" />
              {optimizing ? "Optimizing..." : "Optimize Database"}
            </Button>
          </div>
        </div>

        {/* Performance Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <Card key={metric.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
                <div className="flex items-center gap-1">
                  {getTrendIcon(metric.trend)}
                  {getStatusBadge(metric.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value} {metric.unit}</div>
                <div className="text-xs text-muted-foreground">
                  {metric.trend === 'up' && '↗ Increasing'}
                  {metric.trend === 'down' && '↘ Decreasing'}
                  {metric.trend === 'stable' && '→ Stable'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Performance Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Database Health</CardTitle>
              <CardDescription>Overall database performance status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Health</span>
                  <Badge variant="default" className="bg-green-600">Excellent</Badge>
                </div>
                <Progress value={92} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Query Performance</span>
                  <Badge variant="default" className="bg-green-600">Good</Badge>
                </div>
                <Progress value={88} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Resource Usage</span>
                  <Badge variant="outline" className="border-yellow-600 text-yellow-600">Moderate</Badge>
                </div>
                <Progress value={65} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Resources</CardTitle>
              <CardDescription>Current system resource utilization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Cpu className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">CPU Usage</span>
                    <span className="text-sm text-muted-foreground">45%</span>
                  </div>
                  <Progress value={45} className="h-2 mt-1" />
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <HardDrive className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Disk Usage</span>
                    <span className="text-sm text-muted-foreground">78%</span>
                  </div>
                  <Progress value={78} className="h-2 mt-1" />
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <Activity className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Memory Usage</span>
                    <span className="text-sm text-muted-foreground">62%</span>
                  </div>
                  <Progress value={62} className="h-2 mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Slow Queries */}
        <Card>
          <CardHeader>
            <CardTitle>Slow Queries</CardTitle>
            <CardDescription>Queries that may need optimization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {slowQueries.map((query, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-mono text-sm bg-muted p-2 rounded mb-2">
                      {query.query}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Avg: {query.avgTime.toFixed(1)}ms</span>
                      <span>Count: {query.count}</span>
                      <span>Last: {query.lastExecuted.toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={query.avgTime > 200 ? "destructive" : "outline"}>
                      {query.avgTime > 200 ? "Slow" : "Normal"}
                    </Badge>
                    <Button size="sm" variant="outline">
                      Optimize
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Optimization Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Optimization Recommendations</CardTitle>
            <CardDescription>Suggested improvements for better performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <div className="font-medium">Add Index on Projects Table</div>
                  <div className="text-sm text-muted-foreground">
                    Create an index on the status column to improve query performance
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <div className="font-medium">Optimize Message Queries</div>
                  <div className="text-sm text-muted-foreground">
                    Consider pagination for large message queries
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <div className="font-medium">Database Maintenance</div>
                  <div className="text-sm text-muted-foreground">
                    Run VACUUM and ANALYZE to optimize database structure
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
