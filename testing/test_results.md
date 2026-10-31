# Lab 4 test execution results

Run on 31 October 2026 in the repository root. “Actual” reports the value verified by the named Vitest assertion in the completed run; Vitest prints a summary, not each passing assertion value. Test IDs and exact inputs are defined in [black-box design](black_box_testing.md) and [white-box design](white_box_testing.md).

| Test ID | Technique | Test input | Expected output | Actual output verified by test | Result |
|---|---|---|---|---|---|
| BB01 | Equivalence/boundary | ratio .8, history .4, ETA 0, walk 0 | availability .8, walk 1, final .88 | .8, 1, .88 | Pass |
| BB02 | Equivalence/specification point | .8/.4, ETA 15, walk 400 | availability .6, final .56 | .6, .56 (close) | Pass |
| BB03 | Boundary | .8/.4, ETA 60, walk 800 | availability .425, walk 0, final .255 | .425, 0, .255 | Pass |
| BB04 | Equivalence/boundary | ratio .8, no history, walk 801 | availability .8, walk 0, final .48 | .8, 0, .48 | Pass |
| BB05 | Equivalence | rain + shelter; .8/.4, ETA 15, walk 400; capped 1/1, walk 0 | final .616; capped final 1 | .616 (close); 1 | Pass |
| BB06 | Equivalence | rain only; shelter only | final .56 for both | .56 for both | Pass |
| BB07 | Invalid class | real-time ratio null | required-ratio `TypeError` | required-ratio error thrown | Pass |
| BB08 | Boundary | ratio 0, no history, walk 799 | availability 0, walk .00125, final .0005 | 0, .00125, .0005 (close) | Pass |
| BB09 | Boundary | ratio 1, no history, walk 800 | availability 1, final .6 | 1, .6 | Pass |
| BB10 | Observed invalid ETA | ETA -15, .8/.4, walk 400 | current behaviour: availability 1.2, final .92 | 1.2, .92 (close) | Pass |
| WB-R1 | Basis path | no candidates | 404 `NO_CARPARKS_FOUND` | same exception/status/code | Pass |
| WB-R2 | Basis path | one valid candidate, no history | one result, score .78 | one result, score .78 (close) | Pass |
| WB-R3 | Basis path | all candidates invalid | 404 `NO_CARPARKS_FOUND` | same exception/status/code | Pass |
| WB-R4 | Basis path | three candidates with differing scores | descending order BK20, AK19, CK21 | BK20, AK19, CK21 | Pass |
| WB-R5 | Basis path | equal-score FIRST, SECOND | FIRST, SECOND | FIRST, SECOND | Pass |
| WB-R6 | Basis path | null ETA, zero total lots, then valid | only VALID | only VALID | Pass |
| WB-H1 | Basis path | historical client null | null | null | Pass |
| WB-H2 | Basis path | five records, four distinct dates | average .64; correct bucket query | .64 (close); expected query calls | Pass |
| WB-H3 | Basis path | query error | null | null | Pass |
| WB-H4 | Basis path | query data null, no error | null | null | Pass |
| WB-H5 | Basis path | query throws | null | null | Pass |

## Commands and scope

| Command | Observed result |
|---|---|
| `pnpm.cmd --filter backend exec vitest run src/modules/recommendation/recommendation-score.test.ts src/modules/recommendation/rank-carparks.test.ts src/modules/recommendation/historical-availability.test.ts --maxWorkers=1 --no-file-parallelism --no-isolate` | 3 files, 29 tests passed. This focused run has no conflicting cross-suite mocks. |
| `pnpm.cmd test` (normal isolation, outside restricted sandbox) | Shared types typecheck passed; backend 29 files/300 tests passed; frontend 20 files/153 tests passed. |
| `pnpm.cmd typecheck` | Exit 0. |
| `pnpm.cmd lint` | Exit 0. |

Initial sandbox attempts produced temporary-file `ENOENT` errors and Supertest `connect EACCES 127.0.0.1`; they did not indicate application defects. A diagnostic full-backend run with `--no-isolate` failed four unrelated availability-alert tests because shared worker state contaminated mocks. The normal isolated `pnpm.cmd test` run resolved this and is the authoritative full-suite result. There are no failing or blocked Lab 4 cases in the final run.
