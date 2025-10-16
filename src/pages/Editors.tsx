import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Mail, DollarSign, Briefcase, UserCircle, Calendar, Edit, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

interface Editor {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  specialty: string;
  employment_type: 'fulltime' | 'freelance';
  hourly_rate: number | null;
  monthly_salary: number | null;
}

export default function Editors() {
  const navigate = useNavigate();
  const [editors, setEditors] = useState<Editor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEditor, setEditingEditor] = useState<Editor | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    specialty: "",
    employment_type: "freelance" as 'fulltime' | 'freelance',
    hourly_rate: "",
    monthly_salary: "",
  });

  useEffect(() => {
    checkAuth();
    loadEditors();
  }, []);

  const checkAuth = async () => {
    const user = await apiClient.getCurrentUser();
    if (!user) {
      navigate("/auth");
    }
  };

  const loadEditors = async () => {
    try {
      const data = await apiClient.getEditors();
      setEditors(data || []);
    } catch (error) {
      console.error("Error loading editors:", error);
      toast.error("Failed to load editors");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      
      if (editingEditor) {
        // Update existing editor
        await apiClient.updateEditor(editingEditor.id, {
          full_name: formData.full_name,
          email: formData.email,
          specialty: formData.specialty,
          employment_type: formData.employment_type,
          hourly_rate: null,
          monthly_salary: formData.employment_type === 'fulltime' && formData.monthly_salary ? parseFloat(formData.monthly_salary) : null,
        });

        toast.success("Editor updated successfully");
        loadEditors();
      } else {
        // Create new editor
        await apiClient.createEditor({
          user_id: user?.id || null,
          full_name: formData.full_name,
          email: formData.email,
          specialty: formData.specialty,
          employment_type: formData.employment_type,
          hourly_rate: null,
          monthly_salary: formData.employment_type === 'fulltime' && formData.monthly_salary ? parseFloat(formData.monthly_salary) : null,
        });

        toast.success("Editor added successfully");
        loadEditors();
      }

      setIsDialogOpen(false);
      setEditingEditor(null);
      setFormData({ full_name: "", email: "", specialty: "", employment_type: "freelance", hourly_rate: "", monthly_salary: "" });
    } catch (error) {
      console.error("Error saving editor:", error);
      toast.error("Failed to save editor");
    }
  };

  const handleEdit = (editor: Editor) => {
    setEditingEditor(editor);
    setFormData({
      full_name: editor.full_name,
      email: editor.email,
      specialty: editor.specialty || "",
      employment_type: editor.employment_type,
      hourly_rate: editor.hourly_rate?.toString() || "",
      monthly_salary: editor.monthly_salary?.toString() || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (editorId: string) => {
    try {
      await apiClient.updateEditor(editorId, { deleted: true });
      setEditors(editors.filter(e => e.id !== editorId));
      toast.success("Editor deleted successfully");
    } catch (error) {
      console.error("Error deleting editor:", error);
      toast.error("Failed to delete editor");
    }
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingEditor(null);
      setFormData({ full_name: "", email: "", specialty: "", employment_type: "freelance", hourly_rate: "", monthly_salary: "" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen">
        <AppSidebar />
        <div className="flex-1 bg-background dark:bg-background">
          {/* Header */}
          <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-3 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                <SidebarTrigger />
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                    <UserCircle className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Editors</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Manage your video editing team</p>
                  </div>
                </div>
              </div>

              <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4 flex-shrink-0">
                    <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Add Editor</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-base sm:text-lg">{editingEditor ? "Edit Editor" : "Add New Editor"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name" className="text-xs sm:text-sm">Full Name</Label>
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) =>
                          setFormData({ ...formData, full_name: e.target.value })
                        }
                        required
                        className="h-9 text-xs sm:text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        required
                        className="h-9 text-xs sm:text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="specialty" className="text-xs sm:text-sm">Specialty</Label>
                      <Textarea
                        id="specialty"
                        value={formData.specialty}
                        onChange={(e) =>
                          setFormData({ ...formData, specialty: e.target.value })
                        }
                        placeholder="e.g., Motion Graphics, Color Grading"
                        rows={3}
                        className="text-xs sm:text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employment_type" className="text-xs sm:text-sm">Employment Type</Label>
                      <Select
                        value={formData.employment_type}
                        onValueChange={(value: 'fulltime' | 'freelance') =>
                          setFormData({ ...formData, employment_type: value })
                        }
                      >
                        <SelectTrigger className="h-9 text-xs sm:text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="freelance" className="text-xs sm:text-sm">Freelance</SelectItem>
                          <SelectItem value="fulltime" className="text-xs sm:text-sm">Full Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.employment_type === 'fulltime' && (
                      <div className="space-y-2">
                        <Label htmlFor="monthly_salary" className="text-xs sm:text-sm">Monthly Salary (₹)</Label>
                        <Input
                          id="monthly_salary"
                          type="number"
                          step="0.01"
                          value={formData.monthly_salary}
                          onChange={(e) =>
                            setFormData({ ...formData, monthly_salary: e.target.value })
                          }
                          className="h-9 text-xs sm:text-sm"
                        />
                      </div>
                    )}

                    <Button type="submit" className="w-full h-9 sm:h-10 text-xs sm:text-sm gradient-primary">
                      {editingEditor ? "Update Editor" : "Add Editor"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </header>

          <main className="px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {editors.map((editor) => (
                <Card key={editor.id} className="shadow-elegant hover:shadow-glow transition-smooth">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm sm:text-base flex-shrink-0">
                        {editor.full_name.charAt(0)}
                      </div>
                      <span className="truncate">{editor.full_name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 sm:space-y-3">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <Mail className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="truncate">{editor.email}</span>
                    </div>
                    {editor.specialty && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <Briefcase className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <span className="truncate">{editor.specialty}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      {editor.employment_type === 'fulltime' ? 'Full Time' : 'Freelance'}
                    </div>
                    {editor.hourly_rate && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-success">
                        <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        ₹{editor.hourly_rate}/hr
                      </div>
                    )}
                    {editor.monthly_salary && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-success">
                        <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        ₹{editor.monthly_salary}/month
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-2 pt-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => navigate(`/editors/${editor.id}/worksheet`)}
                        className="w-full h-8 sm:h-9 text-xs sm:text-sm gradient-primary"
                      >
                        View Worksheet
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(editor)}
                          className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
                        >
                          <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1 h-8 sm:h-9 text-xs sm:text-sm text-destructive hover:text-destructive">
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="sm:max-w-[425px]">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-base sm:text-lg">Delete Editor?</AlertDialogTitle>
                              <AlertDialogDescription className="text-xs sm:text-sm">
                                Are you sure you want to delete {editor.full_name}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                              <AlertDialogCancel className="h-9 text-xs sm:text-sm m-0">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(editor.id)} className="h-9 text-xs sm:text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 m-0">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {editors.length === 0 && (
              <div className="text-center py-8 sm:py-12">
                <UserCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
                <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">No editors added yet</p>
                <Button onClick={() => setIsDialogOpen(true)} className="h-9 sm:h-10 text-xs sm:text-sm gradient-primary">
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  Add Your First Editor
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
