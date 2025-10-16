# Video Feedback & Chat Access Fix for Shared Projects

## 🐛 Problem Report

### Issue 1: 403 Forbidden on Feedback Submission
**Error**: `POST http://localhost:3001/api/versions/ab8e2aed-86f2-401b-ba98-0da23f372dd0/feedback 403 (Forbidden)`

**Root Cause**: 
- The `VideoFeedbackController` was checking if `version.creator_id !== userId`
- This meant **only the project owner** could submit feedback
- Shared users with chat/view permissions were being blocked

### Issue 2: Chat Box Not Opening for New Users
**Symptom**: "abhi bhi chat box open nahi ho raha hai" - New users can't see chat interface

**Root Cause**:
- Multiple potential issues:
  1. Share token context might be lost during navigation
  2. Project data not loading properly for shared projects
  3. User not being automatically added to chat members

## ✅ Solutions Implemented

### Fix 1: Video Feedback Permission Check (All Methods)

Updated all 4 methods in `VideoFeedbackController` to allow shared users:

#### Files Modified:
- `src/server/controllers/video-feedback.controller.ts`

#### Changes Made:

1. **getFeedback()** - Allow shared users to view feedback
2. **createFeedback()** - Allow shared users to submit feedback  
3. **updateFeedback()** - Allow shared users to edit feedback
4. **deleteFeedback()** - Allow shared users to delete feedback

#### Access Check Logic:
```typescript
// Check if user is project owner OR has shared access
const hasAccess = this.db.prepare(`
  SELECT 1 FROM (
    -- User is project owner
    SELECT 1 WHERE ? = ?
    UNION
    -- User has access via project_share_access_log
    SELECT 1 FROM project_share_access_log psal
    JOIN project_shares ps ON psal.share_id = ps.id
    WHERE ps.project_id = ? AND psal.user_id = ? AND ps.is_active = 1
    UNION
    -- User is chat member
    SELECT 1 FROM project_chat_members pcm
    WHERE pcm.project_id = ? AND pcm.user_id = ?
  ) LIMIT 1
`).get(userId, version.creator_id, version.project_id, userId, version.project_id, userId);
```

**Key Points**:
- Checks 3 permission sources:
  1. Project ownership (creator_id)
  2. Share access log (users who accessed via share link)
  3. Chat membership (users who joined project chat)
- Uses `userId` fallback: `(req as any).user?.userId || (req as any).user?.id`
- Returns 403 only if ALL checks fail

### Fix 2: Enhanced Chat Page Logging

Added comprehensive logging to help debug chat loading issues:

#### Files Modified:
- `src/pages/Chat.tsx`

#### Changes Made:

```typescript
const loadProjectData = async () => {
  if (!selectedProjectId) {
    console.log('🔧 Chat: No selectedProjectId, skipping project load');
    return;
  }

  console.log('🔧 Chat: Loading project data for:', selectedProjectId);
  console.log('🔧 Chat: Has shareToken:', !!shareToken);
  console.log('🔧 Chat: Has shareInfo:', !!shareInfo);

  try {
    if (shareToken && shareInfo) {
      console.log('🔧 Chat: Using shareInfo to set selected project');
      setSelectedProject({
        id: shareInfo.project_id,
        name: shareInfo.project_name || 'Shared Project',
        is_shared: true,
        share_token: shareToken
      });
      console.log('🔧 Chat: Selected project set from shareInfo');
    } else {
      console.log('🔧 Chat: Loading project via API');
      const project = await apiClient.getProject(selectedProjectId);
      setSelectedProject(project);
      console.log('🔧 Chat: Selected project set from API:', project.name);
    }
  } catch (error: any) {
    console.error("🔧 Chat: Failed to load project:", error);
    if (shareInfo) {
      console.log('🔧 Chat: Using shareInfo as fallback');
      setSelectedProject({
        id: shareInfo.project_id,
        name: shareInfo.project_name || 'Shared Project',
        is_shared: true,
        share_token: shareToken
      });
      console.log('🔧 Chat: Selected project set from shareInfo (fallback)');
    } else {
      console.error('🔧 Chat: No shareInfo available for fallback');
    }
  }
};
```

**Benefits**:
- Clear visibility into chat loading flow
- Easy to identify which code path is executing
- Helps diagnose share token context issues

## 🧪 Testing Steps

### Test 1: Video Feedback from Shared Project

1. **Setup**:
   ```
   User A: Project owner (cf6f9de7-dcc7-40a4-b04d-b64ec74d027d)
   User B: New user accessing via share link
   ```

2. **Steps**:
   - User B opens share link: `http://localhost:8080/shared/6M3VsZ4rJ_Vp1UnQyZBT7h_iImdAndgT`
   - Login as User B
   - Click on any video version
   - Add feedback comment at any timestamp
   - Submit feedback

3. **Expected Results**:
   - ✅ No 403 error
   - ✅ Feedback submits successfully (201 Created)
   - ✅ Feedback appears in list
   - ✅ User B can see all feedback
   - ✅ User B can edit their own feedback
   - ✅ User B can delete their own feedback

4. **Backend Logs to Verify**:
   ```
   🔧 Creating feedback for version: ab8e2aed-86f2-401b-ba98-0da23f372dd0
   🔧 User ID: a0e68122-4f7f-4624-b9ef-455cfccd7d3c
   🔧 User has access to submit feedback
   🔧 Feedback created with ID: [UUID]
   POST /api/versions/ab8e2aed-86f2-401b-ba98-0da23f372dd0/feedback 201
   ```

### Test 2: Chat Opening from Shared Project

1. **Setup**:
   - Same User B from above test
   - Already logged in
   - On shared project page

2. **Steps**:
   - On shared project page, click "Join Chat" button
   - Or navigate to Chat via sidebar
   - Or click shared project in chat list

3. **Expected Results**:
   - ✅ Chat window opens
   - ✅ Project name visible in chat header
   - ✅ Message input available
   - ✅ Can send messages
   - ✅ Can see messages from User A

4. **Frontend Console Logs**:
   ```
   🔧 Chat: Loading project data for: 258d2986-1d37-4c46-94ca-8ea7222de163
   🔧 Chat: Has shareToken: true
   🔧 Chat: Has shareInfo: true
   🔧 Chat: Using shareInfo to set selected project
   🔧 Chat: Selected project set from shareInfo
   ```

5. **Backend Logs to Verify**:
   ```
   GET /api/projects/258d2986-1d37-4c46-94ca-8ea7222de163/chat-members 200
   GET /api/messages?project_id=258d2986-1d37-4c46-94ca-8ea7222de163 200
   ```

### Test 3: Chat Navigation Flow

1. **Path A - From Shared Project Page**:
   - Open shared link → Login → Click "Join Chat"
   - ✅ Should navigate to `/chat?share=TOKEN&project=ID`
   - ✅ Chat window should open immediately

2. **Path B - From Chat Sidebar**:
   - Open Chat page from sidebar
   - Click on shared project in chat list (marked with Share2 icon)
   - ✅ Should navigate to `/chat?share=TOKEN&project=ID`
   - ✅ Chat window should open

3. **Path C - Direct Chat Link**:
   - Navigate directly to `/chat?share=TOKEN&project=ID`
   - ✅ Should load project via share token
   - ✅ Chat window should open

## 🔍 Debugging Guide

### If Feedback Still Returns 403

1. **Check Backend Logs**:
   ```
   🔧 Creating feedback for version: [VERSION_ID]
   🔧 User ID: [USER_ID]
   🔧 Access denied for user: [USER_ID] on project: [PROJECT_ID]
   ```

2. **Verify Database**:
   ```sql
   -- Check if user is in access log
   SELECT * FROM project_share_access_log 
   WHERE user_id = 'USER_ID';

   -- Check if user is chat member
   SELECT * FROM project_chat_members 
   WHERE user_id = 'USER_ID' AND project_id = 'PROJECT_ID';

   -- Check active shares
   SELECT * FROM project_shares 
   WHERE project_id = 'PROJECT_ID' AND is_active = 1;
   ```

3. **Common Issues**:
   - ❌ User not in `project_share_access_log` → Check if `/log-access` endpoint was called
   - ❌ User not in `project_chat_members` → Check if user clicked "Join Chat"
   - ❌ Share is inactive → Check `is_active` column in `project_shares`

### If Chat Window Not Opening

1. **Check Frontend Console**:
   ```
   🔧 Chat: Loading project data for: [PROJECT_ID]
   🔧 Chat: Has shareToken: [true/false]
   🔧 Chat: Has shareInfo: [true/false]
   ```

2. **Verify State**:
   - Is `selectedProjectId` set?
   - Is `selectedProject` set?
   - Is `shareInfo` populated?

3. **Check URL Parameters**:
   ```
   /chat?share=TOKEN&project=ID
   ```
   - Both `share` and `project` should be present for shared projects

4. **Common Issues**:
   - ❌ Missing `selectedProject` state → Check `loadProjectData()` execution
   - ❌ Share token lost during navigation → Verify `handleChatClick()` in ChatList
   - ❌ API call failing → Check network tab for 404/403 errors

## 📊 Database Schema Reference

### project_share_access_log
```sql
CREATE TABLE project_share_access_log (
  id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL,
  user_id TEXT,
  accessed_at TEXT NOT NULL,
  FOREIGN KEY (share_id) REFERENCES project_shares(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);
```

### project_chat_members
```sql
CREATE TABLE project_chat_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT,
  guest_name TEXT,
  share_id TEXT,
  joined_at TEXT NOT NULL,
  last_seen_at TEXT,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id),
  FOREIGN KEY (share_id) REFERENCES project_shares(id)
);
```

## 🎯 Summary

### What Was Fixed

1. **Video Feedback Permissions**:
   - ✅ Shared users can now submit feedback
   - ✅ Shared users can view feedback
   - ✅ Shared users can edit their feedback
   - ✅ Shared users can delete their feedback
   - ✅ All methods check 3 permission sources (owner, access log, chat member)

2. **Chat Loading**:
   - ✅ Enhanced logging for debugging
   - ✅ Better error handling and fallbacks
   - ✅ Clear console output for diagnosis

### Files Modified

1. `src/server/controllers/video-feedback.controller.ts` - 4 methods updated
2. `src/pages/Chat.tsx` - Enhanced logging in `loadProjectData()`

### Next Steps for User

1. **Test the feedback submission**:
   - Try adding feedback from VideoPreview page
   - Should see 201 success instead of 403 error

2. **Test chat navigation**:
   - Check console for new log messages
   - Report which specific navigation path fails (if any)

3. **Share console output**:
   - Look for lines starting with `🔧 Chat:`
   - This will help identify exact issue

### Expected Behavior Now

**Feedback Submission**:
```
Frontend: User clicks "Submit Feedback"
  ↓
Backend: POST /api/versions/:versionId/feedback
  ↓
Controller: Checks 3 permission sources
  ↓ (if any source grants access)
Response: 201 Created ✅
```

**Chat Opening**:
```
User clicks shared project in chat list
  ↓
Navigate to: /chat?share=TOKEN&project=ID
  ↓
Chat.tsx: loadUserData() → loads shareInfo
  ↓
Chat.tsx: loadProjectData() → sets selectedProject from shareInfo
  ↓
Render: ChatWindow with project data ✅
```

---

## 🔧 Additional Notes

- All fixes maintain backward compatibility with owned projects
- No changes needed to database schema
- User ID fallback handles both `userId` and `id` fields
- Logging can be kept in production for monitoring
- Consider adding toast notifications for better UX feedback

