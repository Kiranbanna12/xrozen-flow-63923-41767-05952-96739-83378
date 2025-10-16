import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Play, Download, Upload, RotateCcw } from "lucide-react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export default function AdminQuery() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  const executeQuery = async () => {
    if (!query.trim()) {
      toast.error("Please enter a query");
      return;
    }

    try {
      setLoading(true);
      const startTime = Date.now();

      // Parse the query to determine operation
      const queryLower = query.toLowerCase().trim();
      
      if (queryLower.startsWith('select')) {
        // Use API client to execute query
        const result = await apiClient.executeQuery(query);
        // Ensure result is an array
        setResults(Array.isArray(result) ? result : []);
      } else if (queryLower.startsWith('insert')) {
        toast.error("INSERT queries are not supported in this interface");
        return;
      } else if (queryLower.startsWith('update')) {
        toast.error("UPDATE queries are not supported in this interface");
        return;
      } else if (queryLower.startsWith('delete')) {
        toast.error("DELETE queries are not supported in this interface");
        return;
      } else {
        toast.error("Unsupported query type");
        return;
      }

      const endTime = Date.now();
      setExecutionTime(endTime - startTime);
      toast.success("Query executed successfully");
    } catch (error) {
      console.error("Query execution error:", error);
      toast.error("Query execution failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const clearQuery = () => {
    setQuery("");
    setResults([]);
    setExecutionTime(null);
  };

  const exportResults = () => {
    if (results.length === 0) {
      toast.error("No results to export");
      return;
    }

    const csv = [
      Object.keys(results[0]).join(','),
      ...results.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query-results.csv';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Results exported successfully");
  };

  return (
    <AdminLayout title="Query Console" description="Execute SQL queries and manage database operations">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Query Console</h1>
            <p className="text-muted-foreground">Execute SQL queries and manage database operations</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={clearQuery}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear
            </Button>
            <Button onClick={executeQuery} disabled={loading}>
              <Play className="mr-2 h-4 w-4" />
              {loading ? "Executing..." : "Execute Query"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>SQL Query Editor</CardTitle>
            <CardDescription>
              Enter your SQL query below. Only SELECT queries are supported for safety.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="SELECT * FROM profiles LIMIT 10;"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-[120px] font-mono text-sm"
            />
            
            {executionTime && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  Execution time: {executionTime}ms
                </Badge>
                <Badge variant="outline">
                  {results.length} rows returned
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {results.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Query Results</CardTitle>
                  <CardDescription>
                    {results.length} rows returned
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={exportResults}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      {Object.keys(results[0] || {}).map((key) => (
                        <th key={key} className="text-left p-2 font-medium">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.slice(0, 100).map((row, index) => (
                      <tr key={index} className="border-b">
                        {Object.values(row).map((value, cellIndex) => (
                          <td key={cellIndex} className="p-2 text-sm">
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {results.length > 100 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Showing first 100 rows of {results.length} total results
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Query Examples</CardTitle>
            <CardDescription>Common SQL queries you can try</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="justify-start h-auto p-3"
                onClick={() => setQuery("SELECT * FROM profiles LIMIT 10;")}
              >
                <div className="text-left">
                  <div className="font-medium">Get all profiles</div>
                  <div className="text-sm text-muted-foreground">SELECT * FROM profiles LIMIT 10;</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto p-3"
                onClick={() => setQuery("SELECT COUNT(*) as total FROM profiles;")}
              >
                <div className="text-left">
                  <div className="font-medium">Count profiles</div>
                  <div className="text-sm text-muted-foreground">SELECT COUNT(*) as total FROM profiles;</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto p-3"
                onClick={() => setQuery("SELECT * FROM projects ORDER BY created_at DESC LIMIT 5;")}
              >
                <div className="text-left">
                  <div className="font-medium">Recent projects</div>
                  <div className="text-sm text-muted-foreground">SELECT * FROM projects ORDER BY created_at DESC LIMIT 5;</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
