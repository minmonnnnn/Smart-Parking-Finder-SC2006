# SC2006 Software Engineering: Design Patterns Implementation Plan

**Author:** Xavier (pandorie)  
**Modules Covered:** Routing & Navigation, Availability Alerts, Recommendation & Search Ranking  
**Target Design Patterns:** Factory Method, Observer, Strategy, Façade  
**Course Reference:** SC2006 Lectures 14 (Design Patterns), 15 (MVC Design Patterns), 16 (Test Fundamentals)

---

## 1. Executive Summary & Codebase Audit

### 1.1 Overview of Current Contributions
Based on codebase analysis and commit history, the user's primary contributions span three interconnected functional areas:
1. **Multi-Modal Routing & Navigation Subsystem** (`apps/backend/src/modules/routing/`, `apps/frontend/src/features/navigation/`):
   - Computes driving routes with fallback models (`getDrivingRoute`), walking routes (`getWalkingRoute`), and corridor-based LTA incident correlation (`lta-traffic.service.ts`).
   - Frontend navigation experience (`NavigationPage.tsx`, `NavigationBottomSheet.tsx`, `NavigationMap.tsx`, `useNavigationRoutes.ts`).
2. **Carpark Availability Alerts Subsystem** (`apps/backend/src/modules/availability/alerts.routes.ts`, `alerts.service.ts`, `alerts.repository.ts`):
   - User alert creation, tier status transition tracking (`hasSignificantAvailabilityChange`), and notification dispatch.
3. **Recommendation & Carpark Ranking Pipeline** (`apps/backend/src/modules/recommendation/recommendation-score.ts`, `rank-carparks.ts`, `search.service.ts`):
   - Multi-factor scoring engine weighing real-time availability ratios, historical availability decay curves, walking proximity, and sheltered weather bonuses.

### 1.2 Design Smells in Current Implementation
While the current code is functional and well-typed, it exhibits several architectural limitations that violate object-oriented design principles taught in SC2006:
- **Tight Instantiation Coupling (Violation of OCP):** Route calculation directly invokes Google Routes REST endpoints with inline JSON parsing and fallback branches inside a single function. Switching between Google Maps, OneMap (Singapore national mapping standard), or offline mock providers requires modifying core service functions.
- **Procedural Polling (Tight Layer Coupling):** Alert processing in `alerts.service.ts` uses an imperative `for...of` loop with a single `sendNotification` callback. There is no decoupled publish-subscribe mechanism for multiple interested listeners (e.g., push notifications, audit logger, live SSE streams, rerouting triggers).
- **Rigid Scoring Heuristics (Lack of Interchangeability):** `recommendation-score.ts` hardcodes a single scoring formula (`0.6 * availability + 0.4 * walking`). There is no mechanism to vary ranking strategies based on driver preferences (e.g., shortest walking distance vs maximum lot availability during rush hour).
- **Subsystem Complexity Exposure (Violation of Demeter / Principle of Least Knowledge):** Clients (controllers or frontend hooks) must coordinate disparate subsystems (driving routes, walking routes, LTA traffic incidents, weather forecasts, and carpark availability) independently.

### 1.3 Design Pattern Assignment Matrix

| Design Pattern | Category | Target Subsystem / Files | Core Motivation |
|---|---|---|---|
| **Factory Method** | Creational | `apps/backend/src/modules/routing/` (`route-provider.factory.ts`) | Decouple route calculation from specific third-party APIs (Google Routes vs OneMap vs Offline Estimation). |
| **Observer** | Behavioral | `apps/backend/src/modules/availability/` (`availability.subject.ts`) & Frontend Navigation | Decouple availability state transitions from notification channels (push, cache, navigation rerouting). |
| **Strategy** | Behavioral | `apps/backend/src/modules/recommendation/` (`strategies/`) | Allow interchangeable carpark ranking algorithms at runtime (Balanced, Proximity, Peak-Hour Availability). |
| **Façade** | Structural | `apps/backend/src/modules/routing/` (`journey.facade.ts`) | Provide a unified, simple interface for complex multi-modal navigation orchestration (driving + walking + LTA traffic + weather). |

---

## 2. Pattern 1: Factory Method (Creational)

### 2.1 Problem in Current Code
In `apps/backend/src/modules/routing/routing.service.ts`:
- `getDrivingRoute()` and `getWalkingRoute()` contain hardcoded fetch logic targeting `https://routes.googleapis.com/...`.
- Fallback estimation algorithms are interleaved within `catch` blocks.
- If Singapore Land Authority's **OneMap Routing API** or an offline testing simulator needs to be introduced, `routing.service.ts` must be directly edited, violating the **Open-Closed Principle (OCP)** (Lecture 14 Slide 16).

### 2.2 Conceptual & Lecture Alignment
- **Lecture 14 (Slides 5–9):** Factory Pattern decouples class selection and object creation from client code.
- Enables switching concrete providers at runtime or via configuration without client code modifications (`Context` uses `Factory` to obtain `AbstractProduct`).

### 2.3 Architecture & UML Class Diagram

```
+--------------------------------------------------------------+
|               <<interface>> IRouteCalculator                 |
+--------------------------------------------------------------+
| + calculateDrivingRoute(origin, dest): Promise<DrivingRoute> |
| + calculateWalkingRoute(origin, dest): Promise<WalkingRoute> |
+--------------------------------------------------------------+
                               ^
         +---------------------+---------------------+
         |                                           |
+--------------------------+             +--------------------------+
|  GoogleRouteCalculator   |             |  EstimationCalculator    |
+--------------------------+             +--------------------------+
| - apiKey: string         |             | - walkingSpeed: number   |
| + calculateDrivingRoute()|             | + calculateDrivingRoute()|
| + calculateWalkingRoute()|             | + calculateWalkingRoute()|
+--------------------------+             +--------------------------+
         ^                                           ^
         |                    <<creates>>            |
+--------------------------------------------------------------+
|                    RouteCalculatorFactory                    |
+--------------------------------------------------------------+
| + createCalculator(providerType?: string): IRouteCalculator  |
+--------------------------------------------------------------+
                               ^
                               | uses
                       +---------------+
                       | RoutingClient |
                       +---------------+
```

### 2.4 Implementation Specification

#### File: `apps/backend/src/modules/routing/calculators/route-calculator.interface.ts`
```typescript
import type { DrivingRoute, WalkingRoute } from '@smart-parking/shared-types';

export interface RouteCoordinates {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}

export interface IRouteCalculator {
  readonly providerName: string;
  calculateDrivingRoute(coords: RouteCoordinates): Promise<DrivingRoute>;
  calculateWalkingRoute(coords: RouteCoordinates): Promise<WalkingRoute>;
}
```

#### File: `apps/backend/src/modules/routing/calculators/google-route.calculator.ts`
```typescript
import type { DrivingRoute, WalkingRoute } from '@smart-parking/shared-types';
import type { IRouteCalculator, RouteCoordinates } from './route-calculator.interface.js';
import { classifyTraffic } from '../traffic-classifier.js';

export class GoogleRouteCalculator implements IRouteCalculator {
  readonly providerName = 'GoogleRoutes';
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('Google Maps API key is required');
    this.apiKey = apiKey;
  }

  async calculateDrivingRoute(coords: RouteCoordinates): Promise<DrivingRoute> {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.description,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: coords.originLat, longitude: coords.originLng } } },
        destination: { location: { latLng: { latitude: coords.destLat, longitude: coords.destLng } } },
        travelMode: 'DRIVE',
        computeAlternativeRoutes: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await response.json();
    // Parse routes and correlate with traffic (preserves existing logic)
    // ...
    return parsedPrimaryRoute;
  }

  async calculateWalkingRoute(coords: RouteCoordinates): Promise<WalkingRoute> {
    // Google Directions API walking implementation
    // ...
    return parsedWalkRoute;
  }
}
```

#### File: `apps/backend/src/modules/routing/calculators/estimation-route.calculator.ts`
```typescript
import { calculateDistanceKm, WALKING_SPEED_M_PER_MIN, type DrivingRoute, type WalkingRoute } from '@smart-parking/shared-types';
import type { IRouteCalculator, RouteCoordinates } from './route-calculator.interface.js';

export class EstimationRouteCalculator implements IRouteCalculator {
  readonly providerName = 'OfflineEstimation';

  async calculateDrivingRoute(coords: RouteCoordinates): Promise<DrivingRoute> {
    const distKm = parseFloat(calculateDistanceKm(coords.originLat, coords.originLng, coords.destLat, coords.destLng).toFixed(1));
    const distMeters = Math.round(distKm * 1000);
    const durationMin = Math.max(2, Math.round((distKm / 35) * 60));

    return {
      polyline: '',
      distanceMeters: distMeters,
      durationMinutes: durationMin,
      trafficStatus: 'Light',
      summary: 'Fastest Route (Estimated)',
    };
  }

  async calculateWalkingRoute(coords: RouteCoordinates): Promise<WalkingRoute> {
    const distKm = calculateDistanceKm(coords.originLat, coords.originLng, coords.destLat, coords.destLng);
    const distMeters = Math.round(distKm * 1000);
    const durationMin = Math.max(1, Math.round(distMeters / WALKING_SPEED_M_PER_MIN));

    return {
      polyline: '',
      distanceMeters: distMeters,
      durationMinutes: durationMin,
    };
  }
}
```

#### File: `apps/backend/src/modules/routing/route-calculator.factory.ts`
```typescript
import type { IRouteCalculator } from './calculators/route-calculator.interface.js';
import { GoogleRouteCalculator } from './calculators/google-route.calculator.js';
import { EstimationRouteCalculator } from './calculators/estimation-route.calculator.js';

export type RouteProviderType = 'google' | 'estimation' | 'onemap';

export class RouteCalculatorFactory {
  static createCalculator(type?: RouteProviderType): IRouteCalculator {
    const configuredType = type || (process.env.ROUTING_PROVIDER as RouteProviderType) || 'google';

    switch (configuredType) {
      case 'google': {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY?.split('#')[0]?.trim();
        if (apiKey) {
          return new GoogleRouteCalculator(apiKey);
        }
        console.warn('[RouteCalculatorFactory] Missing GOOGLE_MAPS_API_KEY, falling back to Estimation');
        return new EstimationRouteCalculator();
      }
      case 'estimation':
        return new EstimationRouteCalculator();
      default:
        throw new Error(`Unsupported route provider: ${configuredType}`);
    }
  }
}
```

---

## 3. Pattern 2: Observer Pattern (Behavioral)

### 3.1 Problem in Current Code
In `apps/backend/src/modules/availability/alerts.service.ts` & `alerts.routes.ts`:
- Availability status changes are evaluated in an imperative loop (`checkAvailabilityAlerts`).
- The function only supports a single `sendNotification` callback.
- New behaviors triggered by availability changes (such as pushing real-time Server-Sent Events to connected browsers, updating search ranking caches, or notifying active navigation sessions to reroute) cannot be added without rewriting the polling loop.

### 3.2 Conceptual & Lecture Alignment
- **Lecture 15 (Slides 7–12, 19–23):** Observer pattern establishes a 1-to-many dependency between Subject and Observers.
- When the Subject's state changes (`notify()`), all registered Observers (`update()`) are invoked without the Subject knowing concrete observer implementations.

### 3.3 Architecture & UML Class Diagram

```
+--------------------------------------------------------------+
|            <<interface>> IAvailabilitySubject                |
+--------------------------------------------------------------+
| + attach(observer: IAvailabilityObserver): void              |
| + detach(observer: IAvailabilityObserver): void              |
| + notify(event: AvailabilityChangeEvent): Promise<void>      |
+--------------------------------------------------------------+
                               ^
                               | implements
+--------------------------------------------------------------+
|                 CarparkAvailabilitySubject                   |
+--------------------------------------------------------------+
| - observers: Set<IAvailabilityObserver>                      |
| + emitAvailabilityChange(carParkNo, prev, curr): Promise<void|
+--------------------------------------------------------------+
                               | notifies (1..*)
                               v
+--------------------------------------------------------------+
|            <<interface>> IAvailabilityObserver               |
+--------------------------------------------------------------+
| + onAvailabilityChanged(event: AvailabilityChangeEvent): void|
+--------------------------------------------------------------+
            ^                                    ^
            |                                    |
+-------------------------+        +---------------------------+
|  UserPushAlertObserver  |        |  NavigationRerouteObserver|
+-------------------------+        +---------------------------+
| + onAvailabilityChanged |        | + onAvailabilityChanged   |
+-------------------------+        +---------------------------+
```

### 3.4 Implementation Specification

#### File: `apps/backend/src/modules/availability/observer/availability-observer.interface.ts`
```typescript
import type { AvailabilityStatus } from '../service.js';

export interface AvailabilityChangeEvent {
  carParkNo: string;
  previousStatus: AvailabilityStatus;
  currentStatus: AvailabilityStatus;
  timestamp: string;
}

export interface IAvailabilityObserver {
  readonly observerId: string;
  onAvailabilityChanged(event: AvailabilityChangeEvent): Promise<void>;
}

export interface IAvailabilitySubject {
  attach(observer: IAvailabilityObserver): void;
  detach(observer: IAvailabilityObserver): void;
  notify(event: AvailabilityChangeEvent): Promise<void>;
}
```

#### File: `apps/backend/src/modules/availability/observer/carpark-availability.subject.ts`
```typescript
import type { IAvailabilitySubject, IAvailabilityObserver, AvailabilityChangeEvent } from './availability-observer.interface.js';

export class CarparkAvailabilitySubject implements IAvailabilitySubject {
  private observers: Set<IAvailabilityObserver> = new Set();

  attach(observer: IAvailabilityObserver): void {
    this.observers.add(observer);
  }

  detach(observer: IAvailabilityObserver): void {
    this.observers.delete(observer);
  }

  async notify(event: AvailabilityChangeEvent): Promise<void> {
    const dispatchPromises = Array.from(this.observers).map(async (observer) => {
      try {
        await observer.onAvailabilityChanged(event);
      } catch (err) {
        console.error(`[AvailabilitySubject] Observer ${observer.observerId} failed:`, err);
      }
    });
    await Promise.allSettled(dispatchPromises);
  }
}
```

#### File: `apps/backend/src/modules/availability/observer/observers/user-push-alert.observer.ts`
```typescript
import type { IAvailabilityObserver, AvailabilityChangeEvent } from '../availability-observer.interface.js';
import { getEnabledAlerts, updateAlertLastKnownStatus } from '../../alerts.repository.js';
import type { SendAvailabilityNotification } from '../../alerts.service.js';

export class UserPushAlertObserver implements IAvailabilityObserver {
  readonly observerId = 'UserPushAlertObserver';

  constructor(private sendNotification: SendAvailabilityNotification) {}

  async onAvailabilityChanged(event: AvailabilityChangeEvent): Promise<void> {
    const alerts = getEnabledAlerts().filter((a) => a.carParkNo === event.carParkNo);

    for (const alert of alerts) {
      if (alert.lastKnownStatus !== event.currentStatus) {
        await this.sendNotification({
          alertId: alert.id,
          userId: alert.userId,
          carParkNo: alert.carParkNo,
          previousStatus: alert.lastKnownStatus,
          currentStatus: event.currentStatus,
        });
        updateAlertLastKnownStatus(alert.id, event.currentStatus);
      }
    }
  }
}
```

#### File: `apps/backend/src/modules/availability/observer/observers/navigation-reroute.observer.ts`
```typescript
import type { IAvailabilityObserver, AvailabilityChangeEvent } from '../availability-observer.interface.js';

export class NavigationRerouteObserver implements IAvailabilityObserver {
  readonly observerId = 'NavigationRerouteObserver';

  async onAvailabilityChanged(event: AvailabilityChangeEvent): Promise<void> {
    // If a destination carpark drops to 'Unavailable' or 0 lots,
    // broadcast navigation advisory to active mobile clients
    if (event.currentStatus === 'Unavailable') {
      console.warn(`[Navigation Advisory] Carpark ${event.carParkNo} became full. Triggering rerouting broadcast.`);
    }
  }
}
```

---

## 4. Pattern 3: Strategy Pattern (Behavioral)

### 4.1 Problem in Current Code
In `apps/backend/src/modules/recommendation/recommendation-score.ts`:
- The score calculation applies one rigid algorithm:
  $$\text{baseScore} = 0.6 \times \text{availability} + 0.4 \times \text{walking}$$
  multiplied by $1.1$ if sheltered and raining.
- Different drivers have completely distinct priorities:
  - **Budget / Proximity driver:** Desires the closest walking distance regardless of lot volatility.
  - **Peak-Hour Commuter:** Requires high availability and heavy historical confidence over walking proximity to avoid circling around full carparks.
  - **Inclement Weather Driver:** Requires strict sheltered guarantees during heavy Singapore monsoon rain.
- Currently, supporting these requires complex nested `if-else` branches inside `calculateRecommendationScore`.

### 4.2 Conceptual & Lecture Alignment
- **Lecture 14 (Slide 8) & Lecture 15 (Slides 13–14, 21–24):** Strategy Pattern defines a family of algorithms, encapsulates each one, and makes them interchangeable at runtime.
- Allows the ranking algorithm to vary independently from the client (`rank-carparks.ts` / `search.service.ts`).

### 4.3 Architecture & UML Class Diagram

```
                       +-------------------------------+
                       |      CarparkRankingContext    |
                       +-------------------------------+
                       | - strategy: IRankingStrategy  |
                       | + setStrategy(strategy): void |
                       | + rank(candidates): Ranked[]  |
                       +-------------------------------+
                                       | delegates to
                                       v
                    +-------------------------------------+
                    |     <<interface>> IRankingStrategy  |
                    +-------------------------------------+
                    | + calculateScore(input): ScoreResult|
                    | + strategyName: string              |
                    +-------------------------------------+
                                       ^
         +-----------------------------+-----------------------------+
         |                             |                             |
+--------------------------+  +--------------------------+  +--------------------------+
| BalancedRankingStrategy  |  |  ProximityFirstStrategy  |  | MaxAvailabilityStrategy  |
+--------------------------+  +--------------------------+  +--------------------------+
| + calculateScore(input)  |  | + calculateScore(input)  |  | + calculateScore(input)  |
| 60% avail / 40% walk     |  | 20% avail / 80% walk     |  | 85% avail / 15% walk     |
+--------------------------+  +--------------------------+  +--------------------------+
```

### 4.4 Implementation Specification

#### File: `apps/backend/src/modules/recommendation/strategies/ranking-strategy.interface.ts`
```typescript
import type { RecommendationInput, RecommendationResult } from '@smart-parking/shared-types';

export interface IRankingStrategy {
  readonly strategyName: string;
  calculateScore(input: RecommendationInput): RecommendationResult;
}
```

#### File: `apps/backend/src/modules/recommendation/strategies/balanced-ranking.strategy.ts`
```typescript
import type { RecommendationInput, RecommendationResult } from '@smart-parking/shared-types';
import type { IRankingStrategy } from './ranking-strategy.interface.js';
import { MAX_ACCEPTABLE_WALKING_DISTANCE_METERS, SHELTERED_RAIN_SCORE_MULTIPLIER } from '../recommendation-score.js';

export class BalancedRankingStrategy implements IRankingStrategy {
  readonly strategyName = 'Balanced';

  calculateScore(input: RecommendationInput): RecommendationResult {
    const { realTimeAvailabilityRatio, historicalAvailabilityRatio, etaMinutes, walkingDistanceMeters, rainExpected, isSheltered } = input;
    if (realTimeAvailabilityRatio === null) {
      throw new TypeError('realTimeAvailabilityRatio is required');
    }

    const availabilityScore =
      historicalAvailabilityRatio === null
        ? realTimeAvailabilityRatio
        : Math.pow(0.5, etaMinutes / 15) * realTimeAvailabilityRatio +
          (1 - Math.pow(0.5, etaMinutes / 15)) * historicalAvailabilityRatio;

    const walkingScore = Math.max(0, 1 - walkingDistanceMeters / MAX_ACCEPTABLE_WALKING_DISTANCE_METERS);
    const baseScore = 0.6 * availabilityScore + 0.4 * walkingScore;
    const finalScore = rainExpected && isSheltered ? Math.min(1, baseScore * SHELTERED_RAIN_SCORE_MULTIPLIER) : baseScore;

    return { availabilityScore, walkingScore, baseScore, finalScore };
  }
}
```

#### File: `apps/backend/src/modules/recommendation/strategies/max-availability.strategy.ts`
```typescript
import type { RecommendationInput, RecommendationResult } from '@smart-parking/shared-types';
import type { IRankingStrategy } from './ranking-strategy.interface.js';

export class MaxAvailabilityStrategy implements IRankingStrategy {
  readonly strategyName = 'MaxAvailability';

  calculateScore(input: RecommendationInput): RecommendationResult {
    const { realTimeAvailabilityRatio, historicalAvailabilityRatio, etaMinutes, walkingDistanceMeters } = input;
    if (realTimeAvailabilityRatio === null) throw new TypeError('realTimeAvailabilityRatio is required');

    const availabilityScore =
      historicalAvailabilityRatio === null
        ? realTimeAvailabilityRatio
        : Math.pow(0.5, etaMinutes / 10) * realTimeAvailabilityRatio +
          (1 - Math.pow(0.5, etaMinutes / 10)) * historicalAvailabilityRatio;

    const walkingScore = Math.max(0, 1 - walkingDistanceMeters / 1200);
    // 85% availability weight for peak hours
    const baseScore = 0.85 * availabilityScore + 0.15 * walkingScore;

    return { availabilityScore, walkingScore, baseScore, finalScore: baseScore };
  }
}
```

#### File: `apps/backend/src/modules/recommendation/carpark-ranking.context.ts`
```typescript
import type { RankedCarpark } from '@smart-parking/shared-types';
import type { IRankingStrategy } from './strategies/ranking-strategy.interface.js';
import { BalancedRankingStrategy } from './strategies/balanced-ranking.strategy.js';
import type { RecommendationCandidate } from './rank-carparks.js';

export class CarparkRankingContext {
  private strategy: IRankingStrategy;

  constructor(initialStrategy?: IRankingStrategy) {
    this.strategy = initialStrategy ?? new BalancedRankingStrategy();
  }

  setStrategy(strategy: IRankingStrategy): void {
    this.strategy = strategy;
  }

  rank(candidates: readonly RecommendationCandidate[]): RankedCarpark[] {
    const scored = candidates.map((candidate) => {
      const realTimeRatio = candidate.availability.availableLots / candidate.availability.totalLots;
      const score = this.strategy.calculateScore({
        realTimeAvailabilityRatio: realTimeRatio,
        historicalAvailabilityRatio: candidate.historicalAvailabilityRatio,
        etaMinutes: candidate.drivingEtaMinutes ?? 0,
        walkingDistanceMeters: candidate.distanceMeters,
        rainExpected: candidate.rainExpected,
        isSheltered: candidate.carpark.isSheltered,
      });

      return {
        carpark: candidate.carpark,
        distanceMeters: candidate.distanceMeters,
        drivingEtaMinutes: candidate.drivingEtaMinutes,
        walkingEtaMinutes: candidate.walkingEtaMinutes,
        availability: candidate.availability,
        recommendationScore: score.finalScore,
      };
    });

    return scored.sort((a, b) => b.recommendationScore - a.recommendationScore);
  }
}
```

---

## 5. Pattern 4: Façade Pattern (Structural)

### 5.1 Problem in Current Code
Currently, in both the frontend hook (`apps/frontend/src/features/navigation/hooks/useNavigationRoutes.ts`) and backend search service (`apps/backend/src/modules/search/search.service.ts`):
- A comprehensive navigation plan requires orchestrating multiple disparate lower-level subsystems:
  1. `getDrivingRoute(origin, carpark)` (Google Maps Directions)
  2. `getWalkingRoute(carpark, destination)` (Walking polyline & duration)
  3. `getLtaTrafficIncidents()` + `hasNearbyIncidents(...)` (LTA incident escalation)
  4. `getWeather(lat, lng)` (NEA 2-hour rain forecast)
  5. `getAvailabilityByCarParkNo(carParkNo)` (Real-time lot cache)
- The client must know the parameters, error conventions, and fallback strategies of each subsystem. This violates the **Principle of Least Knowledge / Law of Demeter** ("talk only to your immediate friends", Lecture 14 Slide 16 & Slide 18).

### 5.2 Conceptual & Lecture Alignment
- **Lecture 14 (Slides 15–20):** Façade provides a unified, higher-level interface to a set of interfaces in a subsystem, making the subsystem easier to use and reducing client coupling.

### 5.3 Architecture & UML Class Diagram

```
+--------------------------------------------------------------+
|                     Navigation Controller                    |
+--------------------------------------------------------------+
                               | calls planCompleteJourney()
                               v
+--------------------------------------------------------------+
|                 <<façade>> JourneyPlanningFacade              |
+--------------------------------------------------------------+
| + planCompleteJourney(req: JourneyPlanRequest): Promise<Plan>|
+--------------------------------------------------------------+
         |                |                  |                |
         v                v                  v                v
+----------------+ +----------------+ +------------+ +-----------------+
| RoutingService | | TrafficService | | WeatherSvc | | AvailabilitySvc |
| (Driving/Walk) | | (LTA Incidents)| | (Rain NEA) | | (Live Lots)     |
+----------------+ +----------------+ +------------+ +-----------------+
```

### 5.4 Implementation Specification

#### File: `apps/backend/src/modules/routing/facade/journey-planning.facade.ts`
```typescript
import type { DrivingRoute, WalkingRoute, AvailabilityInfo, WeatherInfo } from '@smart-parking/shared-types';
import { RouteCalculatorFactory } from '../route-calculator.factory.js';
import { getLtaTrafficIncidents, hasNearbyIncidents } from '../lta-traffic.service.js';
import { getWeather } from '../../weather/weather.service.js';
import { getAvailabilityByCarParkNo } from '../../availability/repository.js';

export interface CompleteJourneyRequest {
  origin: { lat: number; lng: number };
  carpark: { carParkNo: string; lat: number; lng: number };
  destination: { lat: number; lng: number };
}

export interface CompleteJourneyPlan {
  driving: DrivingRoute;
  walking: WalkingRoute;
  carparkAvailability: AvailabilityInfo | null;
  weather: { rainExpected: boolean; summary?: string };
  incidentsDetected: boolean;
  totalDurationMinutes: number;
}

export class JourneyPlanningFacade {
  private routeCalculator = RouteCalculatorFactory.createCalculator();

  async planCompleteJourney(req: CompleteJourneyRequest): Promise<CompleteJourneyPlan> {
    const { origin, carpark, destination } = req;

    // 1. Concurrent execution of independent subsystem operations
    const [drivingRouteResult, walkingRouteResult, weatherResult, incidentsResult] =
      await Promise.allSettled([
        this.routeCalculator.calculateDrivingRoute({
          originLat: origin.lat,
          originLng: origin.lng,
          destLat: carpark.lat,
          destLng: carpark.lng,
        }),
        this.routeCalculator.calculateWalkingRoute({
          originLat: carpark.lat,
          originLng: carpark.lng,
          destLat: destination.lat,
          destLng: destination.lng,
        }),
        getWeather(destination.lat, destination.lng),
        getLtaTrafficIncidents(),
      ]);

    // 2. Safe resolution of sub-services
    const drivingRoute = drivingRouteResult.status === 'fulfilled' ? drivingRouteResult.value : null;
    const walkingRoute = walkingRouteResult.status === 'fulfilled' ? walkingRouteResult.value : null;
    const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : { rainExpected: false };
    const incidents = incidentsResult.status === 'fulfilled' ? incidentsResult.value : [];

    // 3. Incident cross-referencing
    const hasIncidents = hasNearbyIncidents(incidents, origin.lat, origin.lng, carpark.lat, carpark.lng);

    // 4. Carpark Availability
    const availability = getAvailabilityByCarParkNo(carpark.carParkNo) ?? null;

    return {
      driving: drivingRoute ?? {
        polyline: '',
        distanceMeters: 0,
        durationMinutes: 10,
        trafficStatus: 'Light',
      },
      walking: walkingRoute ?? {
        polyline: '',
        distanceMeters: 0,
        durationMinutes: 5,
      },
      carparkAvailability: availability,
      weather: {
        rainExpected: weather.rainExpected,
      },
      incidentsDetected: hasIncidents,
      totalDurationMinutes: (drivingRoute?.durationMinutes ?? 10) + (walkingRoute?.durationMinutes ?? 5),
    };
  }
}
```

#### File: `apps/backend/src/modules/routing/routing.routes.ts` (Simplified Controller)
```typescript
import { Router } from 'express';
import { JourneyPlanningFacade } from './facade/journey-planning.facade.js';

const router = Router();
const journeyFacade = new JourneyPlanningFacade();

// Unified endpoint for complete journey navigation
router.post('/journey/plan', async (req, res, next) => {
  try {
    const plan = await journeyFacade.planCompleteJourney(req.body);
    res.status(200).json(plan);
  } catch (error) {
    next(error);
  }
});

export default router;
```

---

## 6. Implementation Roadmap & Testing Plan (Lecture 16 Alignment)

### 6.1 Phased Implementation Roadmap

```
Phase 1: Factory Method (Routing Subsystem)
├── Step 1.1: Extract IRouteCalculator interface.
├── Step 1.2: Implement GoogleRouteCalculator & EstimationRouteCalculator.
└── Step 1.3: Build RouteCalculatorFactory and update routing.service.ts.

Phase 2: Strategy Pattern (Recommendation Subsystem)
├── Step 2.1: Define IRankingStrategy interface.
├── Step 2.2: Implement BalancedRankingStrategy, MaxAvailabilityStrategy, ProximityFirstStrategy.
└── Step 2.3: Integrate CarparkRankingContext with rankCarparks() in rank-carparks.ts.

Phase 3: Façade Pattern (Navigation Subsystem)
├── Step 3.1: Create JourneyPlanningFacade coordinating routing, weather, LTA incidents, availability.
└── Step 3.2: Add POST /api/routes/journey/plan endpoint and connect to frontend useNavigationRoutes.

Phase 4: Observer Pattern (Availability Alert Subsystem)
├── Step 4.1: Implement CarparkAvailabilitySubject.
├── Step 4.2: Implement UserPushAlertObserver & NavigationRerouteObserver.
└── Step 4.3: Refactor checkAvailabilityAlerts() to publish events through the Subject.
```

### 6.2 Testing Fundamentals (Lecture 16)

In accordance with **Lecture 16: Test Fundamentals**:
1. **Equivalence Class & Boundary Value Testing (BVT):**
   - For `Strategy`: Test distance inputs at boundaries (e.g., $0\text{m}$, $799\text{m}$, $800\text{m}$, $801\text{m}$ for `MAX_ACCEPTABLE_WALKING_DISTANCE_METERS`).
   - For `Factory`: Test invalid provider names, missing API keys, and environment fallbacks.
2. **Control Flow Graph (CFG) & Basis Path Testing:**
   - In `CarparkAvailabilitySubject`: Calculate Cyclomatic Complexity ($V(G) = E - N + 2P$) for observer attachment/detachment and notification dispatch loops.
   - Ensure $100\%$ basis path coverage in unit test suites (`*.test.ts`).
3. **Mocking Subsystems via Interfaces:**
   - Because `IRouteCalculator` and `IRankingStrategy` are interfaces, tests can inject mocks without hitting Google Maps or external network APIs, reducing test fragility and execution time.

---

## 7. Summary of Architectural Benefits

| Quality Attribute | Before Refactoring | After Refactoring (With 4 Design Patterns) |
|---|---|---|
| **Extensibility (OCP)** | Adding a new map provider required modifying `routing.service.ts`. | Simply implement `IRouteCalculator` and register in `RouteCalculatorFactory`. |
| **Coupling** | Direct dependencies between clients and low-level APIs. | High cohesion and loose coupling via Interfaces and Façades. |
| **Testability** | Hard to test without external APIs or mock servers. | Pure unit testing through strategy injection and mock route calculators. |
| **Maintainability** | Monolithic functions handling parsing, computation, and fallbacks. | Single Responsibility Principle (SRP) per class. |

