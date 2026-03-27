---
description: Start a new Ledger work session with pre-flight cost suggestions
argument-hint: "[type] [goal]"
---

Start a new work session. The user has provided: $ARGUMENTS

Parse the arguments: the first word is the session type (feature|bug|refactor|explore|research — default to "other" if not provided or not one of these). Everything after is the goal string.

Steps:
1. Determine the sessions directory: look for a `sessions/` folder in the current working directory. If it doesn't exist, create it and create an empty `sessions/.current-session` file.

2. Check for an existing active session: read `sessions/.current-session`. If it contains a filename, warn the user that a session is already active and ask if they want to end it first.

3. Search for similar past sessions: look in `sessions/` for .md files whose frontmatter `type` matches the requested type, or whose `goal` field contains similar keywords. Find the 3 most expensive similar sessions (highest `cost_usd` in frontmatter).

4. Display pre-flight suggestions: for each expensive similar session found, read the session file and extract lessons. Show a pre-flight block like:
   ```
   Pre-flight Check — N similar sessions found
   ────────────────────────────────────────────
   Average cost for [type] sessions: $X.XX
   Most expensive: $Y.YY ([date]) — [key lesson from that session]

   Suggestions:
   → [specific actionable suggestion based on lessons]
   → [another suggestion if relevant]
   ```
   If no similar sessions exist, skip this block.

5. Create the session file: name it `YYYY-MM-DD-HHMM-[slugified-goal].md` using the current date/time. Write it with this structure:
   ```markdown
   ---
   type: [type]
   goal: "[goal string]"
   start_time: [ISO 8601 timestamp]
   project: [current directory name]
   ---

   # Session: [goal]

   **Type:** [type] | **Started:** [human-readable datetime] | **Project:** [cwd]

   ## Goals
   - [goal]

   ## Progress

   ## Git State at Start
   [run git status and git log --oneline -5 and include output here]

   ## Issues & Solutions

   ## Lessons Learned
   ```

6. Write the session filename (just the filename, not full path) to `sessions/.current-session`.

7. Confirm to the user: "Session started: [filename]. Use /project:session-update to log progress, /project:session-end when done."
