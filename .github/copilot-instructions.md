# GitHub Copilot Instructions for This Project

## CRITICAL RULES - ALWAYS FOLLOW

### ❌ DO NOT CREATE THESE FILES:
1. **NO Markdown (.md) files** - Never create documentation, summary, or guide files in .md format
2. **NO explanation files** - Do not create files that explain changes or implementations
3. **NO summary files** - Do not create files that summarize work done
4. **NO guide files** - Do not create step-by-step guide files
5. **NO documentation files** - Do not create separate documentation files unless explicitly requested

### ✅ WHAT TO DO INSTEAD:
- Make direct code changes in existing files
- Use inline comments in code files when explanation is needed
- Provide verbal explanation in chat only
- Focus on implementation, not documentation
- If user asks for explanation, provide it in chat response only

### 📝 EXCEPTIONS (Only when user explicitly asks):
- User specifically requests: "create a README file"
- User specifically requests: "create documentation"
- User asks: "write this in a markdown file"

### 🎯 WORKFLOW:
1. User asks for a feature → Implement it directly in code
2. User asks to fix something → Fix it directly in code
3. User asks "how does it work?" → Explain in chat, DO NOT create .md file
4. User asks "what did you change?" → Explain in chat, DO NOT create summary file

## PROJECT-SPECIFIC RULES:

### File Operations:
- Only edit/create .tsx, .ts, .jsx, .js, .css, .json, .sql files when implementing features
- Do not create parallel documentation for code changes
- Keep workspace clean - no redundant files

### Communication Style:
- Be concise in responses
- Code first, explain later
- Don't waste time on documentation that won't be read

## REMEMBER:
**The workspace already has too many .md files. DO NOT ADD MORE unless explicitly requested by the user with clear intent to create documentation.**

---
*These instructions are permanent for this workspace. Follow them strictly.*
