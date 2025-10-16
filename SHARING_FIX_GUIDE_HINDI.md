# Project Sharing 403 Error - Fix करें (हिंदी में)

## समस्या क्या है?
Share button पर click करने पर 403 (Forbidden) error आ रहा है। Link generate नहीं हो रही।

## कारण
Database में `project_shares`, `project_share_access_log`, और `project_chat_members` tables नहीं बनी हैं।

## Solution - Step by Step

### स्टेप 1: Database Tables बनाएं

आपको database में नई tables बनानी होंगी। नीचे दिए गए किसी भी तरीके से:

#### तरीका A: Migration File चलाएं (सबसे अच्छा)

1. अपना database client खोलें (Supabase SQL Editor या pgAdmin)
2. File खोलें: `supabase/migrations/20251011_project_sharing.sql`
3. पूरा SQL copy करें
4. Database में paste करें और Run करें

#### तरीका B: Quick Setup (तेज़)

1. File खोलें: `setup-project-sharing-quick.sql`
2. पूरा SQL copy करें
3. Database SQL editor में paste करें
4. Run करें

#### तरीका C: Direct SQL (सबसे आसान)

अपने database SQL editor में जाएं और यह paste करके run करें:

```sql
-- Project shares table
CREATE TABLE IF NOT EXISTS public.project_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    share_token TEXT NOT NULL UNIQUE,
    can_view BOOLEAN NOT NULL DEFAULT true,
    can_edit BOOLEAN NOT NULL DEFAULT false,
    can_chat BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_shares_token ON public.project_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON public.project_shares(project_id);

-- Access log table
CREATE TABLE IF NOT EXISTS public.project_share_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL REFERENCES public.project_shares(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    guest_identifier TEXT,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_agent TEXT,
    ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_project_share_access_log_share_id ON public.project_share_access_log(share_id);

-- Chat members table
CREATE TABLE IF NOT EXISTS public.project_chat_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    guest_name TEXT,
    share_id UUID REFERENCES public.project_shares(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_project_chat_members_project_id ON public.project_chat_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_chat_members_user_id ON public.project_chat_members(user_id);
```

### स्टेप 2: Backend Server Restart करें

SQL चलाने के बाद:

1. Terminal में जाएं जहां server चल रहा है
2. `Ctrl+C` दबाकर बंद करें
3. फिर से चालू करें:
   ```bash
   npm run dev
   ```
   या
   ```bash
   bun run dev
   ```

### स्टेप 3: Browser में Test करें

1. Browser page को refresh करें (F5)
2. किसी project पर click करें
3. "Share" button पर click करें
4. Permissions select करें (Edit/Chat)
5. "Create Share Link" पर click करें
6. ✅ Link generate हो जानी चाहिए!

## Check करें Tables बन गई हैं या नहीं

Database में यह query चलाएं:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('project_shares', 'project_share_access_log', 'project_chat_members');
```

**Result**: 3 rows दिखने चाहिए:
1. project_shares
2. project_share_access_log
3. project_chat_members

## Console में क्या दिखना चाहिए (Fix के बाद)

Browser console (F12) में:
```
🔧 Adding auth header for request to /project-shares
```

Terminal में:
```
🔧 POST /project-shares - User: [आपकी user-id] Project: [project-id]
🔧 Projects found: 1 project_id: [project-id]
🔧 Generated share token: [32-character-token]
🔧 Creating share with data: {...}
🔧 Share created successfully: [result]
```

## अगर फिर भी Error आए

### Error: "table project_shares does not exist"
**मतलब**: Migration नहीं चली
**Solution**: ऊपर का SQL फिर से चलाएं (तरीका C)

### Error: "User not authenticated"
**मतलब**: आप login नहीं हैं
**Solution**: 
1. Logout करें
2. Cookies clear करें
3. फिर से login करें

### Error: "Project not found"
**मतलब**: Project ID गलत है
**Solution**: दूसरे project को try करें

### Error: Still 403 after tables created
**Check करें**:
1. Server restart किया या नहीं?
2. Browser refresh किया या नहीं?
3. Correct project खोला है या नहीं?
4. Login हैं या नहीं?

## Testing Checklist (सब check करें)

Fix करने के बाद:
- [ ] SQL migration चला दिया
- [ ] Backend server restart कर दिया
- [ ] Browser page refresh कर दिया
- [ ] Valid account से login हैं
- [ ] किसी existing project पर click किया
- [ ] Share dialog खुल गई
- [ ] "Create Link" tab दिख रहा है
- [ ] Permissions select कर सकते हैं
- [ ] "Create Share Link" button काम कर रहा
- [ ] Link generate हो रही है (no error)
- [ ] Copy button काम कर रहा
- [ ] "Active Links" tab में link दिख रही है

## Success के बाद क्या करें

जब link generate होने लगे:
1. ✅ Link copy करें
2. ✅ New browser tab में खोलें
3. ✅ Shared project view देखें
4. ✅ Feedback feature test करें (अगर Edit permission दी हो)
5. ✅ Chat join test करें (अगर Chat permission दी हो)
6. ✅ Access Log में entry check करें

## याद रखें

1. **हमेशा**: SQL migration सबसे पहले चलाएं
2. **हमेशा**: Server restart करें migration के बाद
3. **हमेशा**: Browser refresh करें
4. **हमेशा**: Login होना ज़रूरी है

## अगर फिर भी Problem हो

तो मुझे भेजें:
1. Browser console का screenshot (F12 खोलकर)
2. Terminal का output
3. Database type (Supabase या Local)
4. Tables check query का result

## Important Files (Already Fixed)

- ✅ `src/server/routes/project-sharing.routes.ts` - Backend code fix हो गया
- ✅ `setup-project-sharing-quick.sql` - Quick migration file बन गई
- ✅ `SHARING_FIX_GUIDE.md` - English instructions
- ✅ यह file - Hindi instructions

---

## Quick Summary (एक नज़र में)

1. **समस्या**: 403 error, link नहीं बन रही
2. **कारण**: Database tables नहीं बनी थीं
3. **Solution**: 
   - SQL migration चलाएं (ऊपर देखें)
   - Server restart करें
   - Browser refresh करें
   - Test करें!

बस इतना ही! अब share button काम करेगा! 🚀
