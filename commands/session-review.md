---
description: Generate a personal efficiency report from your session history
argument-hint: "[N] (number of sessions to analyze, default 20)"
---

Generate a personal Claude Code efficiency report.

Parse $ARGUMENTS for a number N (default 20).

Steps:
1. Find all session files in `sessions/` that have cost data in frontmatter (cost_usd field present).

2. Take the most recent N sessions with cost data.

3. Analyze:
   - Average cost by session type
   - Dead-end sessions (cost > $1, commits = 0)
   - Cache hit rate trends
   - Most/least expensive sessions
   - Common lessons across sessions (scan the "## Lessons Learned" sections)

4. Write a structured report:
   ```
   Your Claude Code Efficiency Profile (last N sessions)
   ───────────────────────────────────────────────────────
   Total spent:    $XX.XX across N sessions
   Avg per session: $X.XX
   Avg $/commit:   $X.XX

   Most efficient type:  [type] ($X.XX/commit avg)
   Least efficient type: [type] ($X.XX/commit avg)

   Dead-end sessions: N ($XX.XX — X% of total spend)

   Top recurring lessons from your past sessions:
   → [lesson that appeared most often]
   → [second most common lesson]
   → [third]

   Suggested focus:
   → [most impactful habit to change based on data]
   → [second suggestion]
   ```

5. Save the report to `sessions/efficiency-report-[YYYY-MM-DD].md`.

6. Show the report inline and confirm where it was saved.
