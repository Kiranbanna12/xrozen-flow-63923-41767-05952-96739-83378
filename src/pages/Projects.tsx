import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Video, Plus } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/database-config";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ProjectsTable } from "@/components/projects/ProjectsTable";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { ProjectSearch } from "@/components/projects/ProjectSearch";

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [sharedProjects, setSharedProjects] = useState<any[]>([]);
  const [editors, setEditors] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [parentProjectId, setParentProjectId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
    loadSharedProjects();
    loadEditors();
    loadClients();
  }, []);

  // Re-fetch shared projects when component becomes visible (e.g., after returning from shared project)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && apiClient.isAuthenticated()) {
        console.log('🔄 Page visible again, refreshing shared projects');
        loadSharedProjects();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also refresh when window gains focus
    const handleFocus = () => {
      if (apiClient.isAuthenticated()) {
        console.log('🔄 Window focused, refreshing shared projects');
        loadSharedProjects();
      }
    };
    
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const loadProjects = async () => {
    try {
      // Check authentication first
      if (!apiClient.isAuthenticated()) {
        console.log('🔧 Projects: Not authenticated, redirecting');
        navigate("/auth");
        return;
      }

      const user = await apiClient.getCurrentUser();
      if (!user) {
        console.log('🔧 Projects: No user data, redirecting to auth');
        navigate("/auth");
        return;
      }

      const projectsData = await apiClient.getProjects();
      // Filter out sub-projects from main projects list
      const mainProjects = (projectsData || []).filter((p: any) => !p.is_subproject);
      setProjects(mainProjects);
      console.log('🔧 Projects: Projects loaded successfully');
    } catch (error: any) {
      console.error('🔧 Projects: Error loading projects:', error);
      if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
        console.log('🔧 Projects: Auth error, redirecting to login');
        navigate("/auth");
      } else {
        toast.error("Failed to load projects");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSharedProjects = async () => {
    try {
      if (!apiClient.isAuthenticated()) {
        return;
      }

      const sharedProjectsData = await apiClient.getMySharedProjects();
      setSharedProjects(sharedProjectsData || []);
      console.log('🔧 Projects: Shared projects loaded successfully:', sharedProjectsData?.length);
    } catch (error: any) {
      console.error('🔧 Projects: Error loading shared projects:', error);
      // Don't show error toast for shared projects failure
    }
  };

  const loadEditors = async () => {
    if (!apiClient.isAuthenticated()) {
      console.log('🔧 Projects: Not authenticated, skipping editors load');
      return;
    }
    
    try {
      const editorsData = await apiClient.getEditors();
      setEditors(editorsData || []);
      console.log('🔧 Projects: Editors loaded successfully');
    } catch (error) {
      console.error("🔧 Projects: Error loading editors:", error);
      // Don't redirect for secondary data loading failures
    }
  };

  const loadClients = async () => {
    if (!apiClient.isAuthenticated()) {
      console.log('🔧 Projects: Not authenticated, skipping clients load');
      return;
    }
    
    try {
      const clientsData = await apiClient.getClients();
      setClients(clientsData || []);
      console.log('🔧 Projects: Clients loaded successfully');
    } catch (error) {
      console.error("🔧 Projects: Error loading clients:", error);
      // Don't redirect for secondary data loading failures
    }
  };

  const handleCreateProject = async (formData: any) => {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      if (editingProject) {
        await apiClient.updateProject(editingProject.id, formData);
        toast.success("Project updated successfully!");
      } else {
        const projectData = {
          ...formData,
          creator_id: user.id
        };

        // Extract sub-projects if present
        const subProjects = formData.subProjects || [];
        delete projectData.subProjects;

        // Create main project
        const createdProject = await apiClient.createProject(projectData);
        
        // Create sub-projects if any
        if (subProjects.length > 0 && createdProject?.id) {
          for (const subProject of subProjects) {
            if (subProject.name) {
              await apiClient.createProject({
                ...subProject,
                creator_id: user.id,
                parent_project_id: createdProject.id,
                is_subproject: true,
                status: 'draft'
              });
            }
          }
          toast.success(`Project and ${subProjects.length} sub-project(s) created successfully!`);
        } else {
          toast.success("Project created successfully!");
        }
      }

      setDialogOpen(false);
      setEditingProject(null);
      setParentProjectId(null);
      loadProjects();
    } catch (error: any) {
      console.error("Project save error:", error);
      toast.error("Failed to save project");
    }
  };

  const handleEdit = (project: any) => {
    setEditingProject(project);
    setParentProjectId(null);
    setDialogOpen(true);
  };

  const handleAddSubProject = (parentId: string) => {
    setParentProjectId(parentId);
    setEditingProject(null);
    setDialogOpen(true);
  };

  const handleDelete = async (projectId: string) => {
    try {
      await apiClient.deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
      toast.success("Project deleted successfully");
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingProject(null);
      setParentProjectId(null);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedProjects = useMemo(() => {
    // Combine owned and shared projects
    let allProjects = [
      ...projects.map(p => ({ ...p, is_shared: false })),
      ...sharedProjects.map(p => ({ ...p, is_shared: true }))
    ];

    // Remove duplicates (if user is both owner and has shared access)
    const uniqueProjects = allProjects.reduce((acc, project) => {
      const existing = acc.find(p => p.id === project.id);
      if (!existing) {
        acc.push(project);
      } else if (project.is_shared && !existing.is_shared) {
        // Keep the owned version, just mark it as also shared
        existing.also_shared = true;
      }
      return acc;
    }, [] as any[]);

    let filtered = uniqueProjects;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(query) ||
        project.project_type?.toLowerCase().includes(query) ||
        project.status.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query)
      );
    }

    // Sort
    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [projects, sharedProjects, searchQuery, sortConfig]);

  const handleProjectClick = (projectId: string, project?: any) => {
    // If project is shared, navigate to shared link instead
    if (project?.is_shared && project?.share_info?.share_token) {
      navigate(`/shared/${project.share_info.share_token}`);
    } else {
      navigate(`/projects/${projectId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen">
        <AppSidebar />
        <div className="flex-1 bg-background dark:bg-background">
          <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-3 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <SidebarTrigger />
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                    <Video className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                  </div>
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Projects</h1>
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <div className="flex-1 sm:flex-initial">
                  <ProjectSearch onSearch={setSearchQuery} />
                </div>
                <Button 
                  variant="outline"
                  className="flex-shrink-0 h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4" 
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">New Project</span>
                  <span className="sm:hidden">New</span>
                </Button>
              </div>
            </div>
          </header>

          <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            <div className="mb-4 sm:mb-6 lg:mb-8">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1 sm:mb-2">Your Projects</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Manage your video editing projects and track progress. Search, sort, and organize with sub-projects.
              </p>
            </div>

            <ProjectsTable
              projects={filteredAndSortedProjects}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddSubProject={handleAddSubProject}
              onProjectClick={handleProjectClick}
              sortConfig={sortConfig}
              onSort={handleSort}
            />

            <ProjectFormDialog
              open={dialogOpen}
              onOpenChange={handleDialogClose}
              editingProject={editingProject}
              onSubmit={handleCreateProject}
              editors={editors}
              clients={clients}
              parentProjectId={parentProjectId}
            />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Projects;
