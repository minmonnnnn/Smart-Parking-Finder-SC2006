# Lab 4 black-box testing

## Subject and contract

The BCE `RecommendationEngine` control in [ARCHITECTURE.md](../docs/ARCHITECTURE.md) is implemented as TypeScript service functions rather than a Java class. Its core decision function is [`calculateRecommendationScore()`](../apps/backend/src/modules/recommendation/recommendation-score.ts); [`rankCarparks()`](../apps/backend/src/modules/recommendation/rank-carparks.ts) applies it to candidates. Tests use the public input/output contract, not internal branches. SRS [FR44–FR49](../docs/SRS_Team1.md) specify availability ratios, historical weighting, walking score, 60/40 base score, and sheltered-rain preference. The code fixes the walking limit at 800 m and the unspecified rain bonus at 1.1.

For the representative calculations below, a standard input is real-time ratio .8, historical ratio .4, ETA 15 min, walk 400 m, no rain, unsheltered. Its expected components are availability .6, walking .5, base .56, final .56.

## Equivalence classes

| Class | Condition | Validity | Expected behaviour | Representative input | Test ID |
|---|---|---|---|---|---|
| EC1 | Real-time ratio in [0,1] | Valid | Scored using FR46 | .8 | BB01 |
| EC2 | Real-time ratio absent (`null`) | Invalid by scorer contract | `TypeError` | null | BB07 |
| EC3 | Historical ratio present | Valid | Time-weighted blend | .4, ETA 15 | BB02 |
| EC4 | Historical ratio unavailable | Valid | Real-time ratio used directly | null, ETA 60 | BB04 |
| EC5 | Arrival now | Valid | Real-time weight 1 | ETA 0 | BB01 |
| EC6 | Later arrival | Valid | Historical weight increases | ETA 60 | BB03 |
| EC7 | Walk below 800 m | Valid | Positive walking score | 799 m | BB08 |
| EC8 | Walk at or beyond 800 m | Valid | Walking score 0 | 800, 801 m | BB03, BB04 |
| EC9 | Rain and sheltered | Valid | Final score ×1.1, capped at 1 | true, true | BB05 |
| EC10 | Rain without shelter | Valid | No rain bonus | true, false | BB06 |
| EC11 | Shelter without rain | Valid | No rain bonus | false, true | BB06 |
| EC12 | Negative ETA | Not constrained by scorer; invalid for caller `rankCarparks` | Scorer currently extrapolates; see limitation | -15 | BB10 |

`rankCarparks` rejects null/negative ETA and malformed availability before scoring. The scorer itself only rejects a null real-time ratio. The SRS does not define a scorer error for ratios outside [0,1]; the ranking test documents acceptance of >1 rather than adding an invented validation rule.

## Boundary values and test cases

| Test | Input difference from standard | Expected result | Vitest location |
|---|---|---|---|
| BB01 | ETA 0, walk 0 | availability .8; walking 1; final .88 | [score test](../apps/backend/src/modules/recommendation/recommendation-score.test.ts) “uses only real-time” |
| BB02 | ETA 15 | availability .6; final .56 | [score test](../apps/backend/src/modules/recommendation/recommendation-score.test.ts) “weights real-time” |
| BB03 | ETA 60, walk 800 | availability .425; walking 0; final .255 | [score test](../apps/backend/src/modules/recommendation/recommendation-score.test.ts) “greater weight” |
| BB04 | history null, ETA 60, walk 801 | availability .8; walking 0; final .48 | [score test](../apps/backend/src/modules/recommendation/recommendation-score.test.ts) “historical availability is unavailable” |
| BB05 | rain + sheltered, plus cap case with ratios 1/1 and walk 0 | final .616; capped case 1 | [score test](../apps/backend/src/modules/recommendation/recommendation-score.test.ts) “sheltered-rain” |
| BB06 | rain only / shelter only | final .56 in each case | [score test](../apps/backend/src/modules/recommendation/recommendation-score.test.ts) “without both” |
| BB07 | real-time null | throws `TypeError` with required-ratio message | [score test](../apps/backend/src/modules/recommendation/recommendation-score.test.ts) “rejects candidates” |
| BB08 | real-time 0, history null, walk 799 | availability 0; walking .00125; final .0005 | [score test](../apps/backend/src/modules/recommendation/recommendation-score.test.ts) “immediately below” |
| BB09 | real-time 1, history null, ETA 0, walk 800 | availability 1; final .6 | [score test](../apps/backend/src/modules/recommendation/recommendation-score.test.ts) “ratio one” |
| BB10 | ETA -15 | current scorer returns availability 1.2; final .92 | [score test](../apps/backend/src/modules/recommendation/recommendation-score.test.ts) “negative ETA” |

The 0 and 1 ratio boundaries are BB08 and BB09; 799/800/801 m are BB08/BB03/BB04. ETA 0 and 15 are BB01/BB02. ETA 15 is an equation landmark, not a branch boundary. Cases combine independent classes where outputs remain unambiguous; existing seven tests were retained and three boundary/observed-behaviour tests added.
