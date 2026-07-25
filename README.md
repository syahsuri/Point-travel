# Point Travel ✈

An interactive, high-performance, real-time flight tracking application focused on Indonesian airspace. Built on top of **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **MapLibre GL**, and **Tailwind CSS v4**.

## Features

- **Interactive Real-Time Map**: Built with MapLibre GL for high-performance WebGL rendering. Includes support for:
  - Dynamic aircraft symbol layers rotated by true track/heading.
  - Selected plane highlighting (swaps blue to white marker color).
  - Dynamic trajectory flight paths connecting selected planes to their destination airports.
  - Toggle layer visibility for planes (✈) and airports (🏢).
- **Multiple Basemaps (Basemap Switcher)**: Swaps layers inside a single style sheet to prevent map flashing/re-rendering:
  - **Streets** (Default): OpenStreetMap raster tiles.
  - **Dark**: Zero-dependency basemap styling utilizing local Natural Earth GeoJSON polygons.
  - **Satellite**: ESRI World Imagery with Reference hybrid labels overlay.
- **HUD Widgets**:
  - **WIB Clock Badge**: Live, ticking WIB clock showing the local Western Indonesian Time (WIB).
  - **Near-Miss Conflict Badge**: Real-time counter of potential mid-air close encounters.
- **Searchable Side Panel**:
  - **Flights List**: Searchable (callsign, airline, route, or ICAO24) and sortable (Newest First / Oldest First based on last position report time) lists of active aircraft.
  - **Airports Directory**: Searchable directory of Indonesian airports showing type classifications (large, medium, small), country, and schedules.
- **Detail Sidebars**:
  - **Flight Information**: Scheduled departures/arrivals, elapsed & remaining distance (in kilometers), flight progress indicators, and dynamically computed ETA.
  - **Aircraft Profile**: Fetches and renders live aircraft photographs dynamically from Planespotters via ICAO24 transponder IDs, along with manufacturer, model, registration, owner, and typecodes.
  - **Historical Track Replay**: Trajectory playback scrubber showing history points and telemetry details. Includes estimation accuracy stats (forecast error in km).
  - **Airport Departures/Arrivals Board**: Detailed flight status listings for selected airports.
- **Advanced Near-Miss Radar Engine**:
  - Automatically calculates turn rate (signed deg/s) by diffing successive heading telemetry.
  - Generates 2-minute forward-looking predictive paths.
  - Flags and alerts mid-air pairs whose predicted paths cross under 5nm (9,260m) horizontally and 600m vertically.
  - Draws dynamic warning red links between conflicting plane pairs on the map.
- **Chaos Mode Easter Egg**:
  - Enter the classic **Konami Code** (`↑↑↓↓←→←→ba`) anywhere on the page to trigger **Chaos Mode** for 10 seconds.
  - Swaps airliner icons for animated **Nyan Cat** markers pulsing in size.
  - Overlays a full-screen retro disco color-cycle and starfield.

## Architecture & Project Structure

The project follows a modern Next.js structure. Frontend modules are split between reusable UI components and specialized custom hooks.

```
point-travel/
├── app/                  # Next.js App Router root
│   ├── api/              # CORS-mitigating API proxy routes
│   │   ├── airports/     # Proxies backend airports directory
│   │   ├── history/      # Proxies historical flown flight paths
│   │   ├── photos/       # Proxies Planespotters plane images
│   │   ├── planes/       # Proxies live OpenSky-like state vectors
│   │   └── schedule/     # Proxies airport departures & arrivals boards
│   ├── components/       # UI Components
│   │   ├── flight-map/   # Specialized map overlays and sidebars
│   │   └── FlightMap.tsx # Main orchestration component
│   ├── globals.css       # Core stylesheets and animations
│   ├── layout.tsx        # HTML skeleton
│   └── page.tsx          # Homepage layout containing FlightMap
├── lib/                  # Services and utility modules
│   ├── hooks/            # Modular state and mapping logic hooks
│   │   ├── useAirportSelection.ts
│   │   ├── useChaosModeVisuals.ts
│   │   ├── useFlightMapEngine.ts   # Core MapLibre initialization and events loop
│   │   ├── useKonamiCode.ts
│   │   ├── useNearMissRadar.ts     # Turn-rate and flight-path projection conflict checker
│   │   ├── usePlanePhoto.ts
│   │   ├── usePlaneSelection.ts
│   │   └── useWibClock.ts
│   ├── airports.ts       # Airports fetcher
│   ├── fetchRetry.ts     # Robust fetching helper with automatic retries
│   ├── format.ts         # Formatting utilities (time, schedules, status tags)
│   ├── geo.ts            # Geospatial math (Haversine distance, path prediction, angle deltas)
│   ├── history.ts        # History fetcher
│   ├── mapConstants.ts   # Map settings, bounding boxes, icons configuration
│   ├── mapStyle.ts       # MapLibre layer and basemap styles definition
│   ├── photos.ts         # Photo fetcher
│   ├── planes.ts         # Planes fetcher
│   ├── schedule.ts       # Schedule fetcher
│   └── types.ts          # TypeScript type definitions and interfaces
└── public/               # Static assets (plane icons, Nyan Cat, placeholder graphics)
```

## API Proxies

Because the flight API backend does not serve CORS headers directly to browsers, Next.js API Routes are set up to proxy requests securely from the server side:

- `/api/planes`: Fetches state vectors representing flights inside Indonesian airspace. Returns a `{ time, states }` envelope. It uses cache headers (`Cache-Control: s-maxage=30, stale-while-revalidate=60`) to optimize query frequency and avoid API rate limits.
- `/api/airports`: Fetches lists of Indonesian airports.
- `/api/history/[tripId]`: Fetches the coordinates path representing the historical flight path of an aircraft.
- `/api/schedule/[iata]/[type]/[limit]`: Fetches arrivals/departures schedules.
- `/api/photos/[icao24]`: Proxies Planespotters image requests.

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended) and `npm`.

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <repository-url>
   cd point-travel
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory (optional, if overriding default API URLs):
   ```env
   FLIGHTS_API_URL=https://flights.gukgukcraft.id/flights
   FLIGHTS_AUTH_TOKEN=your_auth_token_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

### Building for Production

Compile the project for production:
```bash
npm run build
npm run start
```

### Running with Docker

Alternatively, build and run the app using Docker:
```bash
# Build the Docker image
docker build -t point-travel .

# Run the container
docker run -p 3000:3000 point-travel
```

---

*This project is built as a highly responsive Next.js application, utilizing client-side canvas layers for fast rendering and server-side routes to communicate with the flight tracking endpoints.*
