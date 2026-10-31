# AI coding-agent experiment summary

| Experiment | Agent task | Initial evidence | Final evidence | Review need |
|---|---|---|---|---|
| 1, control regeneration | Rebuild `calculateRecommendationScore()` in an isolated worktree from FR44-FR49, shared types, and Section 3.2 black-box tests | Original baseline 10/10; removed module could not load tests | First generated version: 10/10 scorer tests, 300/300 backend tests, backend typecheck | Prior agent exposure to original limits independence; check untested inputs and unspecified constants |
| 2, FR45 mismatch | Correct per-carpark Singapore arrival bucket in `getNearbyCarparks()` | Regression tests before fix: 1 pass, 6 fail | After one correction: 7/7 new cases, 307/307 backend, 153/153 frontend, all typechecks and lint | Team should review missing-ETA fallback and integration with live data |

Evidence and exact commands: [Experiment 1](experiment_1.md) and [Experiment 2](experiment_2.md). Worktrees: `C:\Users\TeikFei\Documents\Codex\2026-09-30\my\lab4-regeneration` and `C:\Users\TeikFei\Documents\Codex\2026-09-30\my\lab4-arrival-fix`. Section 3.2 files and the main-checkout production implementation remain intact. No changes were committed, pushed, or merged.
