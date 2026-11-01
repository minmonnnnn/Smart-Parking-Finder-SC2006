# Smart Parking Finder

A mobile-first web application that helps users find nearby carparks, check real-time availability, and navigate to their destination. Built for SC2006 Software Engineering.

## Features

- Search for carparks near a destination
- Real-time carpark availability with alerts
- Turn-by-turn driving and walking navigation with live route simulation
- Carpark recommendations based on availability, walking distance, driving distance, weather and historical data
- Favourites and user profile management
- EV and sheltered carpark filters

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Backend:** Node.js, Express, TypeScript
- **Database:** Supabase (PostgreSQL)
- **Maps:** Google Maps JavaScript API
- **Package Manager:** pnpm (monorepo)

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [pnpm](https://pnpm.io/) v12.4.2 or later (`npm install -g pnpm`)
- A Google Maps API key (Maps JavaScript API + Directions API enabled)
- A Supabase project (URL + anon key)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/minmonnnnn/Smart-Parking-Finder-SC2006.git
cd Smart-Parking-Finder-SC2006
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

**Frontend** — create `apps/frontend/.env.local`:

```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BACKEND_URL=http://localhost:3000
```

**Backend** — create `apps/backend/.env`:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATA_GOV_API_KEY=your_data_gov_sg_api_key
PORT=3000
```

### 4. Run the development servers

Start the backend:

```bash
pnpm dev:backend
```

Start the frontend (in a separate terminal):

```bash
pnpm dev:frontend
```

The app will be available at `http://localhost:5173`.

## Running Tests

```bash
# Run all tests
pnpm test

# Run backend tests only
pnpm --filter backend test

# Run frontend tests only
pnpm --filter frontend test
```

## Project Structure

```
sc2006/
├── apps/
│   ├── frontend/        # React + Vite frontend
│   └── backend/         # Express backend
├── packages/
│   └── shared-types/    # Shared TypeScript types
└── testing/             # Lab test documentation and AI experiment reflections
```

## Team

| Member   | GitHub                                       |
| -------- | -------------------------------------------- |
| Min      | [@minmonnnnn](https://github.com/minmonnnnn) |
| Xavier   | [@pandorie](https://github.com/pandorie)     |
| Moufooza | [@moufooza](https://github.com/moufooza)     |
| Nigel    | [@nhjr2000](https://github.com/nhjr2000)     |
| Teik Fei | [@Teik-Fei](https://github.com/Teik-Fei)     |
| Shan Xi  | [@xi7869](https://github.com/xi7869)         |
