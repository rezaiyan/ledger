---
description: End the current session, inject cost data, extract lessons
---

End the current active session and enrich it with cost data.

Steps:
1. Read `sessions/.current-session`. If empty, tell the user no active session is running.

2. Read the full session file from `sessions/[filename]`.

3. Get the end time (now). Calculate duration from `start_time` in frontmatter.

4. Run `git log --oneline` since the session start time to count commits:
   Use: `git log --oneline --after="[start_time]"` and count the lines.
   Also run `git diff --shortstat HEAD~[commits] HEAD` to get lines added/removed.

5. Fetch cost data: run `ledger status` via bash (if available) to get the current session's cost. Alternatively, tell the user to check `ledger today` for cost data and ask them to provide it if they know it. Note in the file that cost data can be enriched by running `npm run ledger -- status`.

6. Update the frontmatter with:
   - end_time, duration_min, commits, lines_added, lines_removed
   - Note that cost_usd will be populated by running `ledger` CLI

7. Complete the "## Lessons Learned" section: read through the progress updates, issues, and git activity, then write 2-4 concrete lessons in this format:
   ```
   - **[category]:** [observation] → [actionable suggestion for next time]
   ```
   Categories: context_strategy, scope, model_choice, tool_usage, planning

8. Add a final "## Session Summary" section:
   ```
   **Duration:** [X]h [Y]m
   **Commits:** [N]
   **Lines:** +[added] / -[removed]
   **Cost:** (run `ledger today` to see)
   ```

9. Clear `sessions/.current-session` (write empty string to it).

10. Confirm: "Session ended. Duration: [X]h [Y]m. [N] commits. Run `ledger today` to see cost."
