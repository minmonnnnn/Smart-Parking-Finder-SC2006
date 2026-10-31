# Experiment 1: Regenerate the recommendation control

## Objective and mapping

Lab 4 Section 3.3.2 asks whether a coding agent can reconstruct an important control implementation from the specification and tests. The BCE `RecommendationEngine` in `docs/ARCHITECTURE.md` is represented by the TypeScript function `calculateRecommendationScore()` in `apps/backend/src/modules/recommendation/recommendation-score.ts`; it is not a literal class. The original production file remains in the main checkout. The experiment is at `C:\Users\TeikFei\Documents\Codex\2026-09-30\my\lab4-regeneration` (detached at `80ce6f2`).

## Materials and prompt

The agent had `docs/ARCHITECTURE.md`, SRS FR44-FR49 in `docs/SRS_Team1.md`, `packages/shared-types/src/recommendation.ts`, `testing/black_box_testing.md`, and the ten-case `recommendation-score.test.ts` copied from the main checkout, including its uncommitted Section 3.2 additions. The controlling user prompt was: “Remove the entire selected implementation module” in an isolated copy, “use the available requirements, tests, design documentation and surrounding code to reconstruct the implementation”, preserve the exported API, run the black-box tests, and compare the result. The prompt also prohibited copying the preserved original into the generated file or replacing production.

Assumptions supplied by the current project contract: walking limit 800 m; sheltered-rain multiplier 1.1 and final cap 1; null real-time ratio throws a `TypeError` with the message expected by callers/tests. FR49 does not give the multiplier value.

## Procedure and actual results

1. Recorded main-checkout original SHA-256: `3A3B51028F8925903A1333288718065E1351972CA5CEC5DAB27C1584A99C368F`. Git revision `80ce6f2` also preserves the committed version.
2. Copied the two uncommitted Section 3.2 test files and `testing/` documents into the experiment worktree. Installed dependencies were referenced through local directory junctions; no `.env` or secret files were copied.
3. Baseline: ran the original scorer test in isolation. **10 passed, 0 failed**.
4. Deleted the entire scorer module in the experiment worktree. The test file then failed to load: `Cannot find module './recommendation-score.js'`; **0 tests executed**. This confirms removal, not a functional test failure.
5. Reconstructed the module from the listed materials. The first version computed the ETA weight once, used explicit history/rain branches, and returned all four score components. It preserved `calculateRecommendationScore`, `MAX_ACCEPTABLE_WALKING_DISTANCE_METERS`, and `SHELTERED_RAIN_SCORE_MULTIPLIER` exports.
6. First regeneration: **10/10 scorer tests passed** and backend TypeScript `tsc --noEmit` exited 0. No correction iteration was needed. Full backend suite in the experiment worktree: **300/300 passed**.

Test command (from the experiment worktree's `apps/backend` directory):

```powershell
& 'C:\Users\TeikFei\Downloads\NTU STUFF\YEAR 2 SEM 1\SC2006\Project_Code\sc2006\apps\backend\node_modules\.bin\vitest.cmd' run src/modules/recommendation/recommendation-score.test.ts --maxWorkers=1 --no-file-parallelism --no-isolate
```

The full-suite check used the same Vitest executable with `run` and normal isolation. The package-manager bootstrap attempted an offline dependency metadata check in the new worktree and failed; direct use of the already installed binaries avoided changing the dependency graph.

## Comparison and limitations

The generated version passes the same black-box cases and preserves the exported API and current error message. Both implement FR46's weighted ratios, FR47's nonnegative walking score, FR48's 60/40 base, FR49's sheltered-rain bonus, and the missing-history fallback. The generated code uses a single weight calculation and explicit `if` blocks; the original uses a ternary for history/rain and computes the weight expression twice. These are structural differences, not observed output differences in the tested cases. Both leave negative ETA validation to callers and accept ratios outside [0,1] at the scorer boundary. Passing tests cannot prove equivalence on every possible input.

This was **not a blind reconstruction**. The same agent had read the original implementation during Section 3.2 and again before removing it for this experiment. That prior exposure could have influenced the generated structure and constants, so the result demonstrates reconstruction in an exposed-agent setting, not independent discovery from requirements alone. Human review remains necessary for unspecified requirements and untested inputs. The generated file remains only in the experiment worktree.
