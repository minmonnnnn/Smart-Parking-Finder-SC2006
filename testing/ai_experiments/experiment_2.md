# Experiment 2: AI-assisted correction of historical arrival lookup

## Selected experiment and requirement

This is Lab 4 Section 3.3.3's requirements-mismatch correction. SRS FR45 requires historical ratios for the same Singapore weekday and one-hour bucket as the **estimated arrival time**. `getNearbyCarparks()` in `apps/backend/src/modules/search/search.service.ts` computed `new Date().getDay()` and `.getHours()` once before obtaining per-carpark driving ETAs, then passed that current-time bucket to every `getHistoricalAvailabilityRatio()` call. The issue still existed at the start of this experiment. It could select the wrong hour or day, and server-local time might not be Singapore time.

## Materials and prompt

Materials: SRS FR45/FR46 and UC-15/UC-16 in `docs/SRS_Team1.md`, `search.service.ts`, `routing.service.ts`, `historical-availability.ts` and its existing tests, Section 3.2 reports, and the current shared types. The controlling user instruction was to correct the lookup “so that the selected historical day/hour corresponds to the carpark's estimated arrival time”, covering per-carpark ETAs, hour/day/week rollover, Singapore local time, missing ETA, and unchanged recommendation behaviour. It required an isolated correction, regression tests, actual execution, and no production merge.

## Procedure, correction, and results

The worktree is `C:\Users\TeikFei\Documents\Codex\2026-09-30\my\lab4-arrival-fix` (detached at `80ce6f2`). The uncommitted Section 3.2 tests and documents were copied into it. No secret files were copied. A new `apps/backend/src/modules/search/search.service.arrival.test.ts` mocks the repository, availability, routing, historical lookup, and weather boundaries while calling the real `getNearbyCarparks()`.

Initial regression run, **before production change**: 7 tests executed; **1 passed, 6 failed**. The same-hour case happened to match. The next-hour, midnight, different-weekday, per-carpark ETA, no-ETA, and route-failure assertions failed. For example, a Singapore Sunday 23:55 search with a ten-minute driving ETA expected Monday 00:00's bucket `(1, 0)` but received Sunday `(0, 23)`.

The correction computes each carpark's arrival after its driving route is available. It adds the ETA in minutes to the current instant, applies Singapore's year-round UTC+08:00 offset, and reads weekday/hour with UTC accessors. Historical lookup is skipped if driving ETA is absent, non-finite, or negative. This fallback is an explicit assumption: FR45/UC-16 require an estimated arrival time, and without a traffic-aware driving ETA there is no reliable historical bucket. The existing scorer then uses real-time availability alone; it still uses the walking ETA for its weight argument, although no historical component is present. A driving-route failure remains marked as degraded routing. Historical data schema and query API were unchanged.

After this single correction iteration: the seven new tests **all passed**. The affected three-file run (new search test, scorer tests, historical tests) passed **24/24**. The full backend suite passed **307/307**, frontend suite **153/153**; backend, frontend, and shared-types TypeScript checks exited 0; root ESLint exited 0. The main checkout's `search.service.ts` was not modified.

Tests cover Singapore same hour, next hour, midnight Sunday-to-Monday, 25-hour Tuesday arrival, two carparks with different ETAs, absent origin/ETA, and rejected driving route. The first four cases use mocked clocks and explicit UTC instants, so results do not depend on the runner's timezone. The regression demonstrates a real behaviour mismatch, but does not call Supabase or Google APIs; those remain integration concerns.

Executed test command (from the worktree's `apps/backend` directory):

```powershell
& 'C:\Users\TeikFei\Downloads\NTU STUFF\YEAR 2 SEM 1\SC2006\Project_Code\sc2006\apps\backend\node_modules\.bin\vitest.cmd' run src/modules/search/search.service.arrival.test.ts --maxWorkers=1 --no-file-parallelism --no-isolate
```

The full backend/frontend runs used their respective installed `vitest.cmd run` executables with normal isolation. The three TypeScript checks used the respective `tsc.cmd --noEmit` executables; lint used root `eslint.cmd . --ext .ts,.tsx`. Direct binaries were necessary because pnpm's new-worktree bootstrap tried to fetch offline package metadata. Restricted-sandbox runs also produced temporary-cache `ENOENT`; final normal-isolation runs outside that restriction are the reported results. The correction and tests remain in the isolated worktree for team review.
