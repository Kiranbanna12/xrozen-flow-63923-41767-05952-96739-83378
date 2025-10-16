import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, Search, Eye, Edit, Download, Plus, RefreshCw } from "lucide-react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface TableInfo {
  name: string;
  rowCount: number;
  columnCount: number;
  diskSize?: number;
  primaryKey?: string[];
  indexCount?: number;
  foreignKeys?: any[];
  columns?: any[];
  indexes?: any[];
}

export default function AdminTables() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      setLoading(true);
      
      // Use API client to get tables
      const tablesData = await apiClient.getTables();
      
      // Ensure we have an array to work with
      const tablesArray = Array.isArray(tablesData) ? tablesData : [];
      
      // Process each table to get detailed information
      const tableInfos: TableInfo[] = await Promise.all(
        tablesArray.map(async (table: any) => {
          try {
            // Get detailed table schema for each table
            const tableSchema = await apiClient.getTableSchema(table.name);
            
            return {
              name: table.name,
              rowCount: table.rowCount || 0,
              columnCount: table.columnCount || 0,
              diskSize: Math.random() * 1000000, // Mock size for now
              primaryKey: tableSchema?.columns?.filter((col: any) => col.pk === 1).map((col: any) => col.name) || [],
              indexCount: tableSchema?.indexes?.length || 0,
              foreignKeys: tableSchema?.foreignKeys || [],
              columns: tableSchema?.columns || [],
              indexes: tableSchema?.indexes || []
            };
          } catch (error) {
            console.warn(`Could not load schema for table ${table.name}:`, error);
            return {
              name: table.name,
              rowCount: table.rowCount || 0,
              columnCount: table.columnCount || 0,
              diskSize: Math.random() * 1000000,
              primaryKey: [],
              indexCount: 0,
              foreignKeys: [],
              columns: [],
              indexes: []
            };
          }
        })
      );

      setTables(tableInfos);
    } catch (error) {
      console.error("Error loading tables:", error);
      toast.error("Failed to load tables");
      
      // Fallback to mock data if API fails
      const mockTables: TableInfo[] = [
        {
          name: "profiles",
          rowCount: 0,
          columnCount: 8,
          diskSize: 0,
          primaryKey: ["id"],
          indexCount: 1,
          foreignKeys: [],
          columns: [],
          indexes: []
        },
        {
          name: "projects", 
          rowCount: 0,
          columnCount: 12,
          diskSize: 0,
          primaryKey: ["id"],
          indexCount: 2,
          foreignKeys: [],
          columns: [],
          indexes: []
        },
        {
          name: "messages",
          rowCount: 0,
          columnCount: 6,
          diskSize: 0,
          primaryKey: ["id"],
          indexCount: 1,
          foreignKeys: [],
          columns: [],
          indexes: []
        },
        {
          name: "payments",
          rowCount: 0,
          columnCount: 10,
          diskSize: 0,
          primaryKey: ["id"],
          indexCount: 1,
          foreignKeys: [],
          columns: [],
          indexes: []
        }
      ];
      
      setTables(mockTables);
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (tableName: string) => {
    try {
      setLoadingData(true);
      setSelectedTable(tableName);
      
      // Use API client to get table data
      const data = await apiClient.getTableData(tableName);
      setTableData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(`Error loading data for table ${tableName}:`, error);
      toast.error(`Failed to load data for table ${tableName}`);
      setTableData([]);
    } finally {
      setLoadingData(false);
    }
  };

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <AdminLayout title="Table Explorer" description="Browse and manage database tables">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Table Explorer" description="Browse and manage database tables">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Table Explorer</h1>
            <p className="text-muted-foreground">Browse and manage database tables</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Table
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Badge variant="outline">
            {filteredTables.length} {filteredTables.length === 1 ? 'table' : 'tables'}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTables.map((table) => (
            <Card key={table.name} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Table className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{table.name}</CardTitle>
                  </div>
                </div>
                <CardDescription>
                  {table.rowCount.toLocaleString()} rows · {table.columnCount} columns · {formatSize(table.diskSize)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Primary Key:</span>
                    <Badge variant="secondary">{table.primaryKey.join(', ') || 'None'}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Indexes:</span>
                    <span className="font-medium">{table.indexCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Foreign Keys:</span>
                    <span className="font-medium">{table.foreignKeys.length}</span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => loadTableData(table.name)}
                      disabled={loadingData && selectedTable === table.name}
                    >
                      <Eye className="mr-2 h-3 w-3" />
                      {loadingData && selectedTable === table.name ? "Loading..." : "View Data"}
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table Data Viewer */}
        {selectedTable && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Table Data: {selectedTable}</CardTitle>
                  <CardDescription>
                    {tableData.length} rows loaded
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => loadTableData(selectedTable)}
                    disabled={loadingData}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingData ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedTable(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : tableData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {Object.keys(tableData[0]).map((column) => (
                          <th key={column} className="text-left p-3 font-medium text-sm">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.slice(0, 100).map((row, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          {Object.values(row).map((value, cellIndex) => (
                            <td key={cellIndex} className="p-3 text-sm">
                              {value === null ? (
                                <span className="text-muted-foreground italic">null</span>
                              ) : typeof value === 'object' ? (
                                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                  {JSON.stringify(value)}
                                </code>
                              ) : typeof value === 'string' && value.length > 50 ? (
                                <span title={value} className="cursor-help">
                                  {value.substring(0, 50)}...
                                </span>
                              ) : typeof value === 'string' && value.includes('@') ? (
                                <span className="text-blue-600">{value}</span>
                              ) : typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/) ? (
                                <span className="text-green-600">{value}</span>
                              ) : (
                                String(value)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {tableData.length > 100 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      Showing first 100 rows of {tableData.length} total rows
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No data found in this table
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {filteredTables.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Table className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No tables found</p>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? `No tables match "${searchQuery}"`
                  : 'Create your first table to get started'}
              </p>
              {!searchQuery && (
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Table
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
