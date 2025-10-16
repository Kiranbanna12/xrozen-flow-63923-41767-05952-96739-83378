import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

interface ProjectFormData {
  name: string;
  description: string;
  project_type: string;
  editor_id: string;
  client_id: string;
  fee: string;
  client_fee: string;
  editor_fee: string;
  agency_margin: string;
  hide_editor_from_client: boolean;
  assigned_date: string;
  deadline: string;
  raw_footage_link: string;
  status: string;
  is_subproject: boolean;
  parent_project_id: string;
}

interface SubProject {
  name: string;
  description: string;
  editor_id: string;
  client_id: string;
  deadline: string;
}

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProject: any;
  onSubmit: (data: any) => void;
  editors: any[];
  clients: any[];
  parentProjectId?: string;
}

export const ProjectFormDialog = ({
  open,
  onOpenChange,
  editingProject,
  onSubmit,
  editors,
  clients,
  parentProjectId
}: ProjectFormDialogProps) => {
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [showAddType, setShowAddType] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hasSubProject, setHasSubProject] = useState(false);
  const [subProjects, setSubProjects] = useState<SubProject[]>([]);
  const [formData, setFormData] = useState<ProjectFormData>({
    name: "",
    description: "",
    project_type: "",
    editor_id: "",
    client_id: "",
    fee: "",
    client_fee: "",
    editor_fee: "",
    agency_margin: "",
    hide_editor_from_client: false,
    assigned_date: "",
    deadline: "",
    raw_footage_link: "",
    status: "draft",
    is_subproject: false,
    parent_project_id: ""
  });

  useEffect(() => {
    loadProjectTypes();
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (editingProject) {
      setFormData({
        name: editingProject.name || "",
        description: editingProject.description || "",
        project_type: editingProject.project_type || "",
        editor_id: editingProject.editor_id || "",
        client_id: editingProject.client_id || "",
        fee: editingProject.fee?.toString() || "",
        client_fee: editingProject.client_fee?.toString() || "",
        editor_fee: editingProject.editor_fee?.toString() || "",
        agency_margin: editingProject.agency_margin?.toString() || "",
        hide_editor_from_client: editingProject.hide_editor_from_client || false,
        assigned_date: editingProject.assigned_date || "",
        deadline: editingProject.deadline || "",
        raw_footage_link: editingProject.raw_footage_link || "",
        status: editingProject.status || "draft",
        is_subproject: editingProject.is_subproject || false,
        parent_project_id: editingProject.parent_project_id || ""
      });
    } else {
      setFormData({
        name: "",
        description: "",
        project_type: "",
        editor_id: "",
        client_id: "",
        fee: "",
        client_fee: "",
        editor_fee: "",
        agency_margin: "",
        hide_editor_from_client: false,
        assigned_date: "",
        deadline: "",
        raw_footage_link: "",
        status: "draft",
        is_subproject: !!parentProjectId,
        parent_project_id: parentProjectId || ""
      });
      setHasSubProject(false);
      setSubProjects([]);
    }
  }, [editingProject, open, parentProjectId]);

  const loadProjectTypes = async () => {
    try {
      // For now, return empty array since we don't have project types API endpoint
      // This should be replaced with actual API call when endpoint is available
      setProjectTypes([]);
    } catch (error) {
      console.error("Error loading project types:", error);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const user = await apiClient.getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  };

  const handleAddProjectType = async () => {
    if (!newTypeName.trim()) {
      toast.error("Please enter a type name");
      return;
    }

    const exists = projectTypes.some(t => t.name.toLowerCase() === newTypeName.toLowerCase());
    if (exists) {
      toast.error("This type already exists");
      return;
    }

    try {
      // For now, just add to local state since we don't have project types API endpoint
      const newType = { id: Date.now().toString(), name: newTypeName.trim() };
      setProjectTypes(prev => [...prev, newType]);
      
      toast.success("Project type added successfully");
      setNewTypeName("");
      setShowAddType(false);
    } catch (error) {
      toast.error("Failed to add project type");
    }
  };

  const handleRemoveProjectType = async (typeId: string) => {
    try {
      // For now, just remove from local state since we don't have project types API endpoint
      setProjectTypes(prev => prev.filter(t => t.id !== typeId));
      toast.success("Project type removed");
    } catch (error) {
      toast.error("Failed to remove project type");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      toast.error("Project name is required");
      return;
    }

    // User type validation
    if (!validateUserPermissions()) {
      return;
    }

    // Sub-project validation
    if (hasSubProject && subProjects.length > 0) {
      for (let i = 0; i < subProjects.length; i++) {
        if (!subProjects[i].name.trim()) {
          toast.error(`Sub-project ${i + 1} name is required`);
          return;
        }
      }
    }

    if (formData.raw_footage_link && !isValidUrl(formData.raw_footage_link)) {
      toast.error("Please enter a valid URL for raw footage link");
      return;
    }

    if (formData.deadline && formData.assigned_date) {
      if (new Date(formData.deadline) < new Date(formData.assigned_date)) {
        toast.error("Deadline cannot be before assigned date");
        return;
      }
    }

    const selectedEditor = editors.find(e => e.id === formData.editor_id);
    const isFreelance = selectedEditor?.employment_type === 'freelance';

    const submitData = {
      ...formData,
      fee: (isFreelance && formData.fee) ? parseFloat(formData.fee) : null,
      editor_id: formData.editor_id || null,
      client_id: formData.client_id || null,
      assigned_date: formData.assigned_date || null,
      deadline: formData.deadline || null,
      raw_footage_link: formData.raw_footage_link || null,
      project_type: formData.project_type || null,
      is_subproject: !!parentProjectId || formData.is_subproject,
      parent_project_id: parentProjectId || formData.parent_project_id || null,
      subProjects: hasSubProject ? subProjects : []
    };

    onSubmit(submitData);
  };

  const validateUserPermissions = () => {
    if (!currentUser) return true; // Skip validation if user not loaded yet

    const userCategory = currentUser.user_category;

    // Editor can only add clients
    if (userCategory === 'editor') {
      if (formData.editor_id && !editingProject) {
        toast.error("Editors can only assign clients, not other editors");
        return false;
      }
    }

    // Client can only add editors
    if (userCategory === 'client') {
      if (formData.client_id && !editingProject) {
        toast.error("Clients can only assign editors, not other clients");
        return false;
      }
    }

    // Agency can add both (no restrictions)

    return true;
  };

  const addSubProject = () => {
    setSubProjects([...subProjects, {
      name: "",
      description: "",
      editor_id: "",
      client_id: "",
      deadline: ""
    }]);
  };

  const removeSubProject = (index: number) => {
    setSubProjects(subProjects.filter((_, i) => i !== index));
  };

  const updateSubProject = (index: number, field: keyof SubProject, value: string) => {
    const updated = [...subProjects];
    updated[index] = { ...updated[index], [field]: value };
    setSubProjects(updated);
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] lg:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">
            {editingProject ? "Edit Project" : parentProjectId ? "Add Sub-Project" : "Create New Project"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {editingProject ? "Update project details" : "Add a new project to your workflow"}
            {currentUser && !editingProject && (
              <span className="block mt-2 text-xs text-muted-foreground">
                {currentUser.user_category === 'editor' && 
                  "📝 As an editor, you can assign clients to your projects"}
                {currentUser.user_category === 'client' && 
                  "📝 As a client, you can assign editors to your projects"}
                {currentUser.user_category === 'agency' && 
                  "📝 As an agency, you can assign both editors and clients"}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs sm:text-sm">Project Name *</Label>
              <Input
                id="name"
                placeholder="Summer Campaign 2025"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="h-9 text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project_type" className="text-xs sm:text-sm">Project Type</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.project_type}
                  onValueChange={(value) => setFormData({ ...formData, project_type: value })}
                >
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTypes.map((type) => (
                      <SelectItem key={type.id} value={type.name} className="text-xs sm:text-sm">
                        <div className="flex items-center justify-between w-full">
                          <span>{type.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveProjectType(type.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => setShowAddType(!showAddType)}
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
              {showAddType && (
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="New type name"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddProjectType())}
                    className="h-9 text-xs sm:text-sm"
                  />
                  <Button type="button" size="sm" onClick={handleAddProjectType} className="h-9 text-xs sm:text-sm">
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs sm:text-sm">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the project..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="text-xs sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Show Editor field only if user is NOT an editor or if editing */}
            {(currentUser?.user_category !== 'editor' || editingProject) && (
              <div className="space-y-2">
                <Label htmlFor="editor" className="text-xs sm:text-sm">Editor</Label>
                <Select
                  value={formData.editor_id}
                  onValueChange={(value) => setFormData({ ...formData, editor_id: value, fee: "" })}
                  disabled={currentUser?.user_category === 'editor' && !editingProject}
                >
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Select editor" />
                  </SelectTrigger>
                  <SelectContent>
                    {editors.map((editor) => (
                      <SelectItem key={editor.id} value={editor.id} className="text-xs sm:text-sm">
                        {editor.full_name} ({editor.employment_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Show Client field only if user is NOT a client or if editing */}
            {(currentUser?.user_category !== 'client' || editingProject) && (
              <div className="space-y-2">
                <Label htmlFor="client" className="text-xs sm:text-sm">Client</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                  disabled={currentUser?.user_category === 'client' && !editingProject}
                >
                  <SelectTrigger className="h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id} className="text-xs sm:text-sm">
                        {client.full_name} {client.company ? `(${client.company})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Role-Based Pricing Section */}
          {formData.editor_id && editors.find(e => e.id === formData.editor_id)?.employment_type === 'freelance' && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
              <h4 className="text-sm font-semibold">Pricing Details</h4>
              
              {/* Agency View: Client Fee + Editor Fee */}
              {currentUser?.user_category === 'agency' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="client_fee" className="text-xs sm:text-sm">
                      Client Fee (₹) <span className="text-muted-foreground">- Amount charged to client</span>
                    </Label>
                    <Input
                      id="client_fee"
                      type="number"
                      step="0.01"
                      placeholder="Amount to charge client"
                      value={formData.client_fee}
                      onChange={(e) => {
                        const clientFee = e.target.value;
                        const editorFee = formData.editor_fee || "0";
                        const margin = (parseFloat(clientFee || "0") - parseFloat(editorFee)).toString();
                        setFormData({ ...formData, client_fee: clientFee, agency_margin: margin, fee: clientFee });
                      }}
                      className="h-9 text-xs sm:text-sm"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="editor_fee" className="text-xs sm:text-sm">
                      Editor Fee (₹) <span className="text-muted-foreground">- Amount paid to editor</span>
                    </Label>
                    <Input
                      id="editor_fee"
                      type="number"
                      step="0.01"
                      placeholder="Amount to pay editor"
                      value={formData.editor_fee}
                      onChange={(e) => {
                        const editorFee = e.target.value;
                        const clientFee = formData.client_fee || "0";
                        const margin = (parseFloat(clientFee) - parseFloat(editorFee || "0")).toString();
                        setFormData({ ...formData, editor_fee: editorFee, agency_margin: margin });
                      }}
                      className="h-9 text-xs sm:text-sm"
                    />
                  </div>
                  
                  {formData.client_fee && formData.editor_fee && (
                    <div className="p-3 bg-background rounded border">
                      <p className="text-sm font-medium">Your Margin: ₹{formData.agency_margin || "0"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Profit from this project
                      </p>
                    </div>
                  )}
                  
                  {/* Hide Editor from Client Option */}
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="hide-editor"
                      checked={formData.hide_editor_from_client}
                      onCheckedChange={(checked) => setFormData({ ...formData, hide_editor_from_client: checked as boolean })}
                    />
                    <Label htmlFor="hide-editor" className="text-xs sm:text-sm font-normal cursor-pointer">
                      Hide editor details from client (Editor name will not be visible to client)
                    </Label>
                  </div>
                </>
              )}
              
              {/* Editor View: Editor Fee Only */}
              {currentUser?.user_category === 'editor' && (
                <div className="space-y-2">
                  <Label htmlFor="editor_fee" className="text-xs sm:text-sm">
                    Your Fee (₹) <span className="text-muted-foreground">- Your earnings from this project</span>
                  </Label>
                  <Input
                    id="editor_fee"
                    type="number"
                    step="0.01"
                    placeholder="Enter your fee"
                    value={formData.editor_fee}
                    onChange={(e) => setFormData({ ...formData, editor_fee: e.target.value, fee: e.target.value })}
                    className="h-9 text-xs sm:text-sm"
                  />
                </div>
              )}
              
              {/* Client View: Client Fee Only */}
              {currentUser?.user_category === 'client' && (
                <div className="space-y-2">
                  <Label htmlFor="client_fee" className="text-xs sm:text-sm">
                    Project Budget (₹) <span className="text-muted-foreground">- Your investment in this project</span>
                  </Label>
                  <Input
                    id="client_fee"
                    type="number"
                    step="0.01"
                    placeholder="Enter project budget"
                    value={formData.client_fee}
                    onChange={(e) => setFormData({ ...formData, client_fee: e.target.value, fee: e.target.value })}
                    className="h-9 text-xs sm:text-sm"
                  />
                </div>
              )}
              
              {/* Default/Fallback: Simple Fee */}
              {!currentUser?.user_category && (
                <div className="space-y-2">
                  <Label htmlFor="fee" className="text-xs sm:text-sm">Project Fee (₹)</Label>
                  <Input
                    id="fee"
                    type="number"
                    step="0.01"
                    placeholder="Enter project fee"
                    value={formData.fee}
                    onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                    className="h-9 text-xs sm:text-sm"
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="assigned_date" className="text-xs sm:text-sm">Assigned Date</Label>
              <Input
                id="assigned_date"
                type="date"
                value={formData.assigned_date}
                onChange={(e) => setFormData({ ...formData, assigned_date: e.target.value })}
                className="h-9 text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline" className="text-xs sm:text-sm">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="h-9 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="raw_footage_link" className="text-xs sm:text-sm">Raw Footage Link</Label>
            <Input
              id="raw_footage_link"
              type="url"
              placeholder="https://drive.google.com/..."
              value={formData.raw_footage_link}
              onChange={(e) => setFormData({ ...formData, raw_footage_link: e.target.value })}
              className="h-9 text-xs sm:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-xs sm:text-sm">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger className="h-9 text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft" className="text-xs sm:text-sm">Draft</SelectItem>
                <SelectItem value="in_review" className="text-xs sm:text-sm">In Review</SelectItem>
                <SelectItem value="approved" className="text-xs sm:text-sm">Approved</SelectItem>
                <SelectItem value="completed" className="text-xs sm:text-sm">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sub-Project Section - Only show if not already a sub-project */}
          {!parentProjectId && !editingProject && (
            <div className="border-t pt-3 sm:pt-4 space-y-3 sm:space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-subproject"
                  checked={hasSubProject}
                  onCheckedChange={(checked) => {
                    setHasSubProject(checked as boolean);
                    if (!checked) {
                      setSubProjects([]);
                    }
                  }}
                />
                <Label htmlFor="has-subproject" className="text-xs sm:text-sm font-medium cursor-pointer">
                  Add Sub-Projects
                </Label>
              </div>

              {hasSubProject && (
                <div className="space-y-3 sm:space-y-4 pl-3 sm:pl-6 border-l-2 border-primary/20">
                  {subProjects.map((subProject, index) => (
                    <div key={index} className="space-y-2 sm:space-y-3 p-3 sm:p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs sm:text-sm font-semibold">Sub-Project {index + 1}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSubProject(index)}
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                        >
                          <X className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Name *</Label>
                        <Input
                          placeholder="Sub-project name"
                          value={subProject.name}
                          onChange={(e) => updateSubProject(index, 'name', e.target.value)}
                          required={hasSubProject}
                          className="h-9 text-xs sm:text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          placeholder="Brief description"
                          value={subProject.description}
                          onChange={(e) => updateSubProject(index, 'description', e.target.value)}
                          rows={2}
                          className="text-xs sm:text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        {(currentUser?.user_category !== 'editor' || editingProject) && (
                          <div className="space-y-2">
                            <Label className="text-xs">Editor</Label>
                            <Select
                              value={subProject.editor_id}
                              onValueChange={(value) => updateSubProject(index, 'editor_id', value)}
                            >
                              <SelectTrigger className="h-9 text-xs sm:text-sm">
                                <SelectValue placeholder="Select editor" />
                              </SelectTrigger>
                              <SelectContent>
                                {editors.map((editor) => (
                                  <SelectItem key={editor.id} value={editor.id} className="text-xs sm:text-sm">
                                    {editor.full_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {(currentUser?.user_category !== 'client' || editingProject) && (
                          <div className="space-y-2">
                            <Label className="text-xs">Client</Label>
                            <Select
                              value={subProject.client_id}
                              onValueChange={(value) => updateSubProject(index, 'client_id', value)}
                            >
                              <SelectTrigger className="h-9 text-xs sm:text-sm">
                                <SelectValue placeholder="Select client" />
                              </SelectTrigger>
                              <SelectContent>
                                {clients.map((client) => (
                                  <SelectItem key={client.id} value={client.id} className="text-xs sm:text-sm">
                                    {client.full_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Deadline</Label>
                        <Input
                          type="date"
                          value={subProject.deadline}
                          onChange={(e) => updateSubProject(index, 'deadline', e.target.value)}
                          className="h-9 text-xs sm:text-sm"
                        />
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSubProject}
                    className="w-full h-9 text-xs sm:text-sm"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    Add Another Sub-Project
                  </Button>
                </div>
              )}
            </div>
          )}

          <Button type="submit" className="w-full h-9 sm:h-10 text-xs sm:text-sm gradient-primary">
            {editingProject ? "Update Project" : "Create Project"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
