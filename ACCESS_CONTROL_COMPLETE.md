# Shared Project Access Control - Complete Implementation

## Date: October 11, 2025

---

## 🎯 New Features Implemented

### 1. **Permission-Based Access Control** ✅
- View-only users cannot add feedback
- Edit permission required for feedback submission
- Chat access requires login + can_chat permission
- Proper error messages for each permission level

### 2. **Login Requirements for Actions** ✅
- Feedback submission requires login (even with edit access)
- Chat access requires login (even with chat permission)
- Clear notifications with login buttons

### 3. **Shared Projects in User's Project List** ✅
- Shared projects appear in user's main projects page
- Clear "Shared" badge on shared projects
- Cannot edit/delete shared projects
- Full access to view and navigate

---

## 🔐 Access Control Matrix

| Permission | View Project | View Versions | View Feedback | Add Feedback | Edit Project | Delete Project | Access Chat |
|------------|--------------|---------------|---------------|--------------|--------------|----------------|-------------|
| **View Only (can_view=1)** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Edit Access (can_edit=1)** | ✅ | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ |
| **Chat Access (can_chat=1)** | ✅ | ✅ | ✅ | Depends on can_edit | ❌ | ❌ | ✅* |
| **Full Access (Owner)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

*Requires login

---

## 📝 Implementation Details

### **1. Video Preview Page Enhancements**

#### Permission Checks Added:

```typescript
// State for share info
const [shareInfo, setShareInfo] = useState<any>(null);

// Load share info to check permissions
if (shareToken) {
  const shareData = await apiClient.getProjectShareByToken(shareToken);
  setShareInfo(shareData);
}

// Feedback submission permission check
const handleAddFeedback = async (commentText: string, timestamp?: number) => {
  if (shareToken && shareInfo) {
    // Check edit permission
    if (!shareInfo.can_edit) {
      toast.error("You only have view access. Please ask the project owner for edit permissions.", {
        duration: 5000,
      });
      return;
    }

    // Check authentication (required for edit operations)
    if (!isAuthenticated || !user?.id) {
      toast.error("Please login to add feedback", {
        duration: 5000,
        action: {
          label: "Login",
          onClick: () => navigate("/auth")
        }
      });
      return;
    }
  }
  
  // Submit feedback...
};
```

#### FeedbackForm Component Updates:

```typescript
interface FeedbackFormProps {
  // ... existing props
  disabled?: boolean;
  disabledMessage?: string;
}

// Usage in VideoPreview
<FeedbackForm
  currentTime={currentTime}
  onAddFeedback={handleAddFeedback}
  playerRef={playerRef}
  disabled={shareToken ? !shareInfo?.can_edit || !isAuthenticated : false}
  disabledMessage={
    shareToken && !shareInfo?.can_edit
      ? "You have view-only access. Ask the owner for edit permissions."
      : !isAuthenticated
      ? "Please login to add feedback"
      : undefined
  }
/>
```

**Visual Changes:**
- Textarea disabled for view-only access
- Button shows "View Only Access" when disabled
- Warning message displayed below button
- Login prompt for unauthenticated users

---

### **2. Chat Page Access Control**

#### Authentication & Permission Checks:

```typescript
const Chat = () => {
  const shareToken = searchParams.get("share");
  const [shareInfo, setShareInfo] = useState<any>(null);

  const loadUserData = async () => {
    // If share token present, check permissions first
    if (shareToken) {
      const shareData = await apiClient.getProjectShareByToken(shareToken);
      
      if (!shareData || !shareData.is_active) {
        toast.error("This share link is invalid or has been deactivated");
        navigate("/");
        return;
      }

      if (!shareData.can_chat) {
        toast.error("You don't have chat access. Please ask the owner for chat permissions.");
        navigate(`/share/${shareToken}`);
        return;
      }

      setShareInfo(shareData);
      setSelectedProjectId(shareData.project_id);
    }

    // Chat requires authentication
    const user = await apiClient.getCurrentUser();
    if (!user) {
      toast.error("Please login to access chat", {
        duration: 5000,
        action: {
          label: "Login",
          onClick: () => navigate("/auth")
        }
      });
      
      // Redirect back to shared project if share token exists
      if (shareToken) {
        navigate(`/share/${shareToken}`);
      } else {
        navigate("/auth");
      }
      return;
    }
  };
};
```

**Flow:**
1. User clicks "Open Chat" from shared project
2. System checks `can_chat` permission
3. If no chat permission → Error + redirect to shared project
4. If has chat permission but not logged in → Login prompt + redirect
5. If both conditions met → Chat opens

---

### **3. Projects Page - Shared Projects Integration**

#### Backend Endpoint: `GET /api/my-shared-projects`

```typescript
router.get('/my-shared-projects', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = (req as any).user?.userId;

  // Method 1: From access logs
  const accessLogs = db.prepare(`
    SELECT DISTINCT ps.project_id
    FROM project_share_access_log psal
    JOIN project_shares ps ON psal.share_id = ps.id
    WHERE psal.user_id = ? AND ps.is_active = 1
  `).all(userId);

  // Method 2: From chat membership
  const chatMemberships = db.prepare(`
    SELECT DISTINCT pcm.project_id
    FROM project_chat_members pcm
    WHERE pcm.user_id = ? AND pcm.share_id IS NOT NULL
  `).all(userId);

  // Combine and get project details
  const projects = db.prepare(`
    SELECT p.*, /* ... with joins */
    FROM projects p
    /* ... */
    WHERE p.id IN (${placeholders})
  `).all(...projectIdsArray);

  return projects with share_info;
});
```

**How It Works:**
- Tracks user's access via `project_share_access_log` table
- Also checks `project_chat_members` for users who joined via share
- Returns all projects user has accessed through share links
- Includes share permission info for each project

#### Frontend Integration:

```typescript
// Projects.tsx
const [sharedProjects, setSharedProjects] = useState<any[]>([]);

const loadSharedProjects = async () => {
  const sharedProjectsData = await apiClient.getMySharedProjects();
  setSharedProjects(sharedProjectsData || []);
};

// Combine owned and shared projects
const filteredAndSortedProjects = useMemo(() => {
  let allProjects = [
    ...projects.map(p => ({ ...p, is_shared: false })),
    ...sharedProjects.map(p => ({ ...p, is_shared: true }))
  ];

  // Remove duplicates (if user owns AND has shared access)
  const uniqueProjects = allProjects.reduce((acc, project) => {
    const existing = acc.find(p => p.id === project.id);
    if (!existing) {
      acc.push(project);
    }
    return acc;
  }, []);

  return uniqueProjects;
}, [projects, sharedProjects]);
```

#### Visual Indicators:

**ProjectsTable Component:**
```tsx
// "Shared" badge next to project name
{(project as any).is_shared && (
  <Badge variant="outline" className="ml-2 text-xs bg-blue-50 text-blue-700 border-blue-300">
    <Share2 className="w-3 h-3 mr-1" />
    Shared
  </Badge>
)}

// Hide edit/delete buttons for shared projects
{!(project as any).is_shared && (
  <>
    <Button onClick={() => onEdit(project)}>
      <Edit className="h-4 w-4" />
    </Button>
    {/* Delete button */}
  </>
)}
```

---

## 🎨 User Experience Flows

### **Flow 1: View-Only User Tries to Add Feedback**

```
1. User receives share link with can_view=1, can_edit=0
2. Opens link → SharedProject page loads
3. Clicks "Watch & Review" on version
4. VideoPreview page opens
5. Tries to type in feedback textarea
   → Textarea is DISABLED
   → Placeholder: "You have view-only access..."
6. Sees button disabled with text "View Only Access"
7. Toast notification appears:
   "You only have view access. Please ask the project owner for edit permissions."
   Duration: 5 seconds
```

### **Flow 2: Edit Access User (Not Logged In) Tries to Add Feedback**

```
1. User receives share link with can_edit=1
2. Opens link → SharedProject page loads
3. NOT logged in
4. Clicks "Watch & Review" on version
5. VideoPreview page opens (no auth required for viewing)
6. Tries to submit feedback
7. System checks: can_edit=1 ✅ but isAuthenticated=false ❌
8. Toast notification with action button:
   "Please login to add feedback"
   [Login Button] → navigates to /auth
9. After login, returns to VideoPreview
10. Can now submit feedback successfully
```

### **Flow 3: User with Chat Access (Not Logged In)**

```
1. User receives share link with can_chat=1
2. Opens link → SharedProject page loads
3. Sees "Join Chat" button (because can_chat=1)
4. Clicks "Join Chat"
5. System checks authentication → Not logged in
6. Toast notification:
   "Please login to join the chat"
   [Login Button] → navigates to /auth
7. After login, automatically joins chat
8. Chat window opens
```

### **Flow 4: User Accesses Shared Project Multiple Times**

```
1. User receives share link
2. Opens link → Access logged in database
3. Closes browser, continues work
4. Days later, logs into account
5. Goes to /projects page
6. Sees shared project in list with "Shared" badge
7. Can click to open like any other project
8. Full access based on original share permissions
9. Cannot edit/delete (buttons hidden)
10. Can use share button to generate own share links
```

---

## 🗄️ Database Tracking

### **Tables Used:**

1. **project_shares**
   - Stores share link information
   - Fields: share_token, can_view, can_edit, can_chat, is_active

2. **project_share_access_log**
   - Tracks who accessed what share link
   - Links users to projects via shares
   - Used to show shared projects in user's list

3. **project_chat_members**
   - Tracks chat memberships
   - Includes `share_id` field for members who joined via share
   - Alternative way to identify shared projects

---

## 🎭 Permission Scenarios

### Scenario 1: View Only
```json
{
  "can_view": 1,
  "can_edit": 0,
  "can_chat": 0
}
```
**User Can:**
- ✅ View project details
- ✅ View versions
- ✅ Watch videos
- ✅ See feedback from others
- ✅ See project in their projects list

**User Cannot:**
- ❌ Add feedback (textarea disabled)
- ❌ Edit feedback
- ❌ Join chat
- ❌ Edit project
- ❌ Delete project

### Scenario 2: Edit Access (Logged In)
```json
{
  "can_view": 1,
  "can_edit": 1,
  "can_chat": 0
}
```
**User Can:**
- ✅ Everything from View Only
- ✅ Add feedback
- ✅ Edit own feedback
- ✅ Delete own feedback

**User Cannot:**
- ❌ Join chat (no can_chat permission)
- ❌ Edit project settings
- ❌ Delete project

### Scenario 3: Full Shared Access (Logged In)
```json
{
  "can_view": 1,
  "can_edit": 1,
  "can_chat": 1
}
```
**User Can:**
- ✅ Everything from Edit Access
- ✅ Join project chat
- ✅ Send messages
- ✅ Participate in discussions

**User Cannot:**
- ❌ Edit project settings (only owner can)
- ❌ Delete project (only owner can)
- ❌ Manage other share links

---

## 🔄 API Endpoints Summary

### **New/Modified Endpoints:**

1. **GET `/api/my-shared-projects`** (NEW)
   - Returns all projects shared with current user
   - Requires authentication
   - Includes share permission info

2. **GET `/api/project-shares/token/:token`** (EXISTING)
   - Used to check permissions before actions
   - Returns share info with can_view, can_edit, can_chat

3. **GET `/api/chat?share=:token`** (MODIFIED)
   - Now checks can_chat permission
   - Requires authentication
   - Redirects appropriately on failure

---

## 📱 UI/UX Changes

### **VideoPreview Page:**
- **Feedback Form:**
  - Disabled state for view-only users
  - Gray out textarea
  - Change button text to "View Only Access"
  - Show warning message below button
  - Login prompt for unauthenticated edit users

### **Projects Page:**
- **Shared Badge:**
  - Blue badge with Share2 icon
  - Appears next to project name
  - Clearly distinguishes shared projects

- **Action Buttons:**
  - Edit button hidden for shared projects
  - Delete button hidden for shared projects
  - Share button still visible (can re-share)
  - Chat button still visible (if has access)

### **Chat Page:**
- **Access Control:**
  - Permission check before loading
  - Clear error messages
  - Automatic redirect to appropriate page
  - Login button in error toast

---

## 🧪 Testing Checklist

### View-Only Access:
- [x] Can view project
- [x] Can view versions
- [x] Can watch videos
- [x] Can see feedback
- [x] Cannot add feedback (textarea disabled)
- [x] Cannot join chat
- [x] Project appears in user's projects list
- [x] Cannot edit/delete project

### Edit Access (Logged In):
- [x] All view-only permissions ✅
- [x] Can add feedback
- [x] Can edit own feedback
- [x] Cannot join chat (if no can_chat)

### Edit Access (Not Logged In):
- [x] Can view everything
- [x] Feedback form shows login prompt
- [x] Click login → redirects to /auth
- [x] After login → can add feedback

### Chat Access:
- [x] Chat button visible on shared project
- [x] Click without login → login prompt
- [x] Click with login → chat opens
- [x] Without can_chat → error message

### Shared Projects List:
- [x] Shared projects appear in /projects
- [x] "Shared" badge visible
- [x] Edit button hidden
- [x] Delete button hidden
- [x] Can click to view project
- [x] Share button still works

---

## 🚀 Deployment Status

```
✅ Backend Server: Running on localhost:3001
✅ Frontend: Running on localhost:8080
✅ Database: SQLite with WAL mode
✅ All routes mounted and tested
✅ Permission checks working
✅ UI updates completed
```

---

## 📋 Modified Files Summary

### Backend:
1. `src/server/routes/project-sharing.routes.ts`
   - Added `/my-shared-projects` endpoint
   - Tracks user access via logs and chat membership

### Frontend:
1. `src/pages/VideoPreview.tsx`
   - Added shareInfo state
   - Permission checks in handleAddFeedback
   - Disabled prop passed to FeedbackForm

2. `src/components/video-preview/FeedbackForm.tsx`
   - Added disabled and disabledMessage props
   - Disabled textarea for view-only
   - Changed button text and appearance
   - Added warning message

3. `src/pages/Chat.tsx`
   - Added share token support
   - can_chat permission check
   - Login requirement
   - Appropriate redirects

4. `src/pages/Projects.tsx`
   - Load shared projects
   - Merge with owned projects
   - Remove duplicates
   - Pass to table

5. `src/components/projects/ProjectsTable.tsx`
   - Show "Shared" badge
   - Hide edit/delete for shared projects
   - Visual styling updates

6. `src/lib/api-client.ts`
   - Added getMySharedProjects() method

---

## 🎓 Key Learnings

1. **Permission-First Design:**
   - Always check permissions before showing UI
   - Disable actions at both UI and API level
   - Clear error messages for each permission level

2. **Authentication Flow:**
   - Some actions visible without login (view)
   - Some actions require login (edit, chat)
   - Smooth redirect flow with return path

3. **Database Tracking:**
   - Multiple ways to track shared access
   - Access logs for analytics
   - Chat membership as alternative indicator

4. **User Experience:**
   - Clear visual indicators (badges, disabled states)
   - Helpful error messages with actions
   - Consistent behavior across pages

---

**Status**: ✅ All Features Implemented and Tested
**Date**: October 11, 2025
**Next Steps**: Monitor user behavior, gather feedback, refine permissions as needed
