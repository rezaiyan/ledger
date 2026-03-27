---
description: Log a progress update to the current session
argument-hint: "[progress note]"
---

Log a progress update to the active session. The update text is: $ARGUMENTS

Steps:
1. Read `sessions/.current-session` to get the current session filename. If empty or file doesn't exist, tell the user no active session is running.

2. Read the session markdown file from `sessions/[filename]`.

3. Append a timestamped update to the "## Progress" section:
   ```
   ### [HH:MM] [progress note]

   **Git state:**
   [run git status --short and git log --oneline -3 and include output]
   ```

4. Write the updated file back.

5. Confirm: "Progress logged at [time]."
