import FlightMap from "./components/FlightMap";

export default function Home() {
  return (
    <main className="relative h-screen w-screen">
      <FlightMap />
      <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-md bg-black/40 px-3 py-2 text-sm font-medium backdrop-blur">
        point-travel · Indonesia
      </div>
    </main>
  );
}
