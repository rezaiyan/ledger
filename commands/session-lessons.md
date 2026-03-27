---
description: Extract and save lessons from the current or last session
---

Extract structured lessons from a session.

Steps:
1. If there's an active session (sessions/.current-session is non-empty), use that. Otherwise use the most recently modified session file in sessions/.

2. Read the full session file.

3. Analyze: read through progress updates, issues & solutions, and any existing lessons.

4. Extract/update the "## Lessons Learned" section with structured lessons:
   ```
   - **context_strategy:** [what happened] → [what to do next time]
   - **scope:** [what happened] → [what to do next time]
   - **model_choice:** [observation] → [recommendation]
   - **tool_usage:** [pattern noticed] → [improvement]
   - **planning:** [what was missing] → [what to do upfront]
   ```
   Only include categories that are actually relevant.

5. Save the updated file.

6. Confirm how many lessons were extracted/updated.
