# NTU SC2006 Team 1 - Routing & Navigation Implementation Document

**Module:** Routing & Navigation (Xavier's Scope)  
**SRS Requirements Covered:** `FR21–FR23`, `FR28–FR34`, `UC-03`, `UC-04`, `UC-09`  
**Git Branch:** `feature/xavier-routing-navigation`  
**Date:** October 2026  

---

## 1. Executive Summary

This document records all architectural decisions, frontend enhancements, API integrations, and bug fixes implemented for the **Smart Parking Recommendation App - Routing & Navigation Module**.

The navigation module delivers a mobile-first, multi-modal routing experience that guides drivers through a **two-leg journey**:
1. **Driving Leg (`A ➔ P`):** From user origin / live GPS position (**`A`**) to the selected carpark (**`P`**).
2. **Walking Leg (`P ➔ B`):** From the carpark (**`P`**) to the final destination venue (**`B`**).

---

## 2. Key Features & Changes Implemented

### 2.1. Mobile Phone Container & Visual Design
* **File:** `apps/frontend/src/NavigationPage.module.css`
* **Features:**
  * Created a responsive mobile device frame (380 × 760px) with 40px rounded corners, realistic drop shadows, and bezel styling.
  * 9:30 AM mobile status bar with signal, 5G, and battery icons matching team UX mockups.
  * Floating header actions row with Return/Menu (`☰`) and options (`•••`).
  * Styled according to Section 7 of the Project Playbook palette:
    * Primary: `#FFC768` (Yellow/Gold)
    * Secondary: `#2563EB` (Navigation Blue)
    * Success: `#10B981` (Walking Green)
    * Danger: `#EF4444` (Alert Red)

### 2.2. Interactive Multi-Point Pin System (`A`, `P`, `B`)
* **File:** `apps/frontend/src/NavigationPage.tsx`
* **Pins Implemented:**
  * **Pin `A` (Origin):** Automatically acquires device GPS on page load via `navigator.geolocation`. If running in desktop emulators, safely falls back to NTU Campus coordinates without crashing.
  * **Pin `P` (Carpark):** Displays recommended Singapore carparks with real-time lot availability indicators (e.g. *Sin Ming MSCP - 48 lots*, *Bishan J8 - 112 lots*, *MBS - 210 lots*, *NTU Carpark F - 88 lots*).
  * **Pin `B` (Destination):** Displays final venue/attraction (e.g. *MacRitchie Reservoir Park*, *Bishan Junction 8*, *Marina Bay Sands*).

### 2.3. Triple-Target Search & Places API (New) Integration
* **Problem Addressed:** Google's legacy autocomplete widget (`google.maps.places.Autocomplete`) failed on new projects with `REQUEST_DENIED` (*"You're calling a legacy API..."*).
* **Solution Implemented:**
  * Migrated directly to Google's modern **Places API (New)** (`https://places.googleapis.com/v1/places:autocomplete` and `places/{id}`).
  * Added top toggle tabs to switch search targets:
    * `[ 📍 Start (A) ]`
    * `[ 🅿️ Carpark (P) ]`
    * `[ 🏁 Dest (B) ]`
  * Real-time debounced search (280ms) restricted to Singapore (`includedRegionCodes: ['sg']`).
  * Tapping any leg in the bottom sheet card (`Change A`, `Change P`, `Change B`) automatically focuses the search bar on that pin.

### 2.4. Dynamic Turn-by-Turn Route & Travel Time Calculation
* **Integration:** Google Routes API (New) (`https://routes.googleapis.com/directions/v2:computeRoutes`).
* **Capabilities:**
  * **Driving Leg:** Queries Google Routes API in `DRIVE` mode with `computeAlternativeRoutes: true`. Retrieves exact driving duration, distance in kilometers, road descriptions, and encoded road polylines.
  * **Walking Leg:** Queries Google Routes API in `WALK` mode from the carpark to the destination. Retrieves exact walking minutes, meters, and pedestrian path.
  * **Polyline Decoding:** Decodes `encodedPolyline` using Google Maps Geometry library (`google.maps.geometry.encoding.decodePath`) so routes trace actual roads (expressways, city streets, park connectors) instead of straight lines.
  * **Alternative Routes Selector (`FR34`):** If Google returns alternative paths, route buttons dynamically display road summaries (e.g. *via Sin Ming Ave* vs *via Marymount Rd*). Clicking either updates the active route, driving line, and ETA.
  * **Camera Fit:** Automatically computes bounding box (`LatLngBounds`) across `A`, `P`, and `B` so the entire journey fits comfortably on screen.
  * **Offline Resilience:** Backed by a Haversine distance model (city driving at 35 km/h, walking at 4.5 km/h) ensuring 100% uptime if Google's API is throttled or offline.

### 2.5. Collapsible Bottom Sheet & GPS Floating Action Button (FAB)
* **Collapsible Bottom Sheet:**
  * **Peek Mode (Collapsed):** Folds down to just the summary row (**`12 mins total`** and the **`MODERATE TRAFFIC`** badge) with a drag pill handle (`▬`) and expand arrow (`▲`). Provides full screen map visibility.
  * **Expanded Mode:** Shows complete breakdown (Origin, Carpark drive, Destination walk, Alternative route buttons, Cancel Nav, and Weather slot).
* **Floating GPS Button (`⌖`):**
  * One-click location refresh.
  * Uses CSS cubic-bezier transitions to smoothly glide down (`bottom: 130px`) when the sheet collapses and glide up (`bottom: 275px`) when expanded, completely preventing visual overlap.

### 2.6. Routing & Environment Infrastructure
* **Routing:** Implemented `@tanstack/react-router` in `apps/frontend/src/router.tsx` and `apps/frontend/src/main.tsx` providing code-based route definition for `/navigation`.
* **TypeScript & Linting:**
  * Installed `@types/google.maps` and configured `tsconfig.app.json`.
  * Configured environment variables in `.env` and `.env.example` (`VITE_GOOGLE_MAPS_API_KEY`).
  * CSS suppression for Google demo modal overlay (`.gm-err-container`, `.gm-style-moc`).
  * 0 TypeScript compiler errors (`tsc -b`) and 0 ESLint warnings (`eslint .`).

---

## 3. File Modification Summary

| File Path | Description of Changes |
| :--- | :--- |
| `apps/frontend/src/NavigationPage.tsx` | Complete navigation page with Google Maps, Places API (New), Routes API (New), 3-point pins (`A`, `P`, `B`), auto-GPS, dynamic ETA calculation, and backend API integration. |
| `apps/frontend/src/NavigationPage.module.css` | Mobile phone container, collapsible bottom sheet, target switcher tabs, lot availability badges, and GPS FAB button animations. |
| `apps/frontend/src/router.tsx` | TanStack React Router configuration with `/navigation` route. |
| `apps/frontend/src/main.tsx` | React 19 application entry point mounting `RouterProvider`. |
| `apps/frontend/tsconfig.app.json` | Added `"google.maps"` to TypeScript compiler type definitions. |
| `apps/frontend/.env.example` | Documented required environment variables (`VITE_GOOGLE_MAPS_API_KEY`, `VITE_API_BASE_URL`). |
| `apps/backend/src/modules/routing/types.ts` | Data models and interfaces (`DrivingRoute`, `WalkingRoute`, `TrafficStatus`, `Coordinates`). |
| `apps/backend/src/modules/routing/routing.service.ts` | Backend routing service calling Google Routes API (New) with traffic condition evaluation and fallback. Exportable for Min's orchestrator and Nigel's recommendation engine. |
| `apps/backend/src/modules/routing/routing.routes.ts` | Express router exposing `GET /api/routes/driving` and `GET /api/routes/walking` with query param validation. |
| `apps/backend/src/index.ts` | Root Express application mounting `/api/routes` router. |
| `apps/backend/tsconfig.json` | Configured Node 22 native `.ts` import compatibility (`rewriteRelativeImportExtensions: true`). |

---

## 4. Verification & Testing Results

* **Frontend Build & Lint:** `pnpm --filter frontend build` and `pnpm --filter frontend lint` pass with 0 errors and 0 warnings.
* **Backend Build & TypeCheck:** `pnpm --filter backend exec tsc --noEmit` passes with 0 errors.
* **Backend Server Test:** Live on `http://localhost:4000`:
  * `GET /api/routes/driving?originLat=...&originLng=...&destLat=...&destLng=...` returns HTTP 200 with route options, distance, duration, traffic status, and encoded polyline.
  * `GET /api/routes/walking?originLat=...&originLng=...&destLat=...&destLng=...` returns HTTP 200 with walking route details.
* **Frontend Navigation Test:** Live on `http://localhost:5173/navigation`:
  1. Auto-location acquires device GPS on mount for Pin `A`.
  2. Pin `A`, Pin `P`, and Pin `B` render at distinct coordinates on Google Maps.
  3. Search autocomplete provides real-time Singapore locations and carparks with lot counts.
  4. Real-time driving and walking routes query backend API with graceful fallbacks.
  5. Bottom sheet collapses and expands with synchronized GPS FAB button movement.

