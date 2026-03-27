---
description: Check current session cost vs. similar sessions average
---

Check the current session's cost tracking status.

Steps:
1. Read `sessions/.current-session`. If empty, show today's overall cost summary instead.

2. Read the current session file to get: type, goal, start_time.

3. Check current cost: run `ledger status` via bash if available.

4. Find similar past sessions in `sessions/`: same type, similar goal keywords. Calculate their average cost.

5. Show a status block:
   ```
   Session Check — [session name]
   ─────────────────────────────────────
   Type:       [type]
   Running:    [duration]
   Cost so far: $X.XX ([N]% of similar session average: $Y.YY)

   Status: [normal / tracking expensive / tracking cheap]

   [If tracking expensive:]
   Similar expensive sessions had these patterns:
   → [lesson from past session]
   Tip: [concrete suggestion]
   ```

6. If no cost data is available, show what IS available (duration, session type, similar session history).
