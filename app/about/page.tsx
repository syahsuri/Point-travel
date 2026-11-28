import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About · Point Travel",
  description:
    "Point Travel is a live flight map for Indonesia, built by a small team as a hobby and portfolio project.",
};

const EMAIL = "support@flight.co.id";

const SOURCES = [
  { name: "OpenSky Network", href: "https://opensky-network.org/", en: "Live aircraft positions (ADS-B)", id: "Posisi pesawat langsung (ADS-B)" },
  { name: "OurAirports", href: "https://ourairports.com/", en: "Airport and runway data", id: "Data bandara dan landasan" },
  { name: "Planespotters.net", href: "https://www.planespotters.net/", en: "Aircraft photos (credited to each photographer)", id: "Foto pesawat (kredit untuk tiap fotografer)" },
  { name: "Esri · Natural Earth · OpenStreetMap", href: "https://www.openstreetmap.org/copyright", en: "Map imagery and labels", id: "Citra dan label peta" },
  { name: "adsb-radar", href: "https://adsb-radar.com/help/icons.html", en: "Aircraft icons", id: "Ikon pesawat" },
];

const COPY = {
  en: {
    lang: "English",
    title: "About Point Travel",
    intro:
      "Point Travel is a live flight map for Indonesia and its neighbours. It is built by a small team as a hobby and portfolio project, not a commercial service.",
    howTitle: "How it works",
    how: "Planes broadcast their position over ADS-B. Volunteer receivers pick it up and share it with the OpenSky Network. We collect those positions every 15 seconds, match them with airport schedules where we can, and draw them on the map.",
    sourcesTitle: "Data sources",
    schedules: "Public airport flight-information boards",
    schedulesNote: "Departure and arrival schedules",
    noteTitle: "Please note",
    note: "This map is for interest only. Do not use it for navigation or any safety decision. Data can be late, incomplete or wrong. Coverage depends on where receivers are, so some regions, especially eastern Indonesia, show few flights.",
    contactTitle: "Contact",
    contact: "Questions, corrections or feedback:",
  },
  id: {
    lang: "Bahasa Indonesia",
    title: "Tentang Point Travel",
    intro:
      "Point Travel adalah peta penerbangan langsung untuk Indonesia dan negara tetangga. Dibuat oleh tim kecil sebagai proyek hobi dan portofolio, bukan layanan komersial.",
    howTitle: "Cara kerja",
    how: "Pesawat memancarkan posisinya lewat ADS-B. Penerima milik relawan menangkap sinyal itu dan membagikannya ke OpenSky Network. Kami mengambil posisi tersebut setiap 15 detik, mencocokkannya dengan jadwal bandara bila tersedia, lalu menampilkannya di peta.",
    sourcesTitle: "Sumber data",
    schedules: "Papan informasi penerbangan bandara (publik)",
    schedulesNote: "Jadwal keberangkatan dan kedatangan",
    noteTitle: "Perhatian",
    note: "Peta ini hanya untuk informasi. Jangan gunakan untuk navigasi atau keputusan keselamatan apa pun. Data bisa terlambat, tidak lengkap, atau salah. Cakupan bergantung pada lokasi penerima, sehingga beberapa wilayah, terutama Indonesia timur, hanya menampilkan sedikit penerbangan.",
    contactTitle: "Kontak",
    contact: "Pertanyaan, koreksi, atau masukan:",
  },
} as const;

export default function AboutPage() {
  return (
    // body is overflow:hidden for the map, so this page scrolls itself.
    <main className="h-dvh overflow-y-auto bg-[#0b1622] text-white/85">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <nav className="mb-8 flex items-center justify-between text-sm">
          <Link href="/" className="text-sky-400 hover:text-sky-300">
            ← Back to map
          </Link>
          <span className="text-white/50">
            <a href="#en" className="hover:text-white">English</a>
            {" · "}
            <a href="#id" className="hover:text-white">Bahasa Indonesia</a>
          </span>
        </nav>

        {(["en", "id"] as const).map((l) => {
          const t = COPY[l];
          return (
            <section
              key={l}
              id={l}
              lang={l}
              className="mb-14 scroll-mt-6 border-b border-white/10 pb-12 last:border-0"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-400/80">
                {t.lang}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-white">{t.title}</h1>
              <p className="mt-4 leading-relaxed">{t.intro}</p>

              <h2 className="mt-8 text-lg font-semibold text-white">{t.howTitle}</h2>
              <p className="mt-2 leading-relaxed">{t.how}</p>

              <h2 className="mt-8 text-lg font-semibold text-white">{t.sourcesTitle}</h2>
              <ul className="mt-3 divide-y divide-white/10 rounded-md border border-white/10">
                {SOURCES.map((s) => (
                  <li key={s.name} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:justify-between">
                    <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300">
                      {s.name}
                    </a>
                    <span className="text-sm text-white/60">{s[l]}</span>
                  </li>
                ))}
                <li className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:justify-between">
                  <span className="text-white">{t.schedules}</span>
                  <span className="text-sm text-white/60">{t.schedulesNote}</span>
                </li>
              </ul>

              <h2 className="mt-8 text-lg font-semibold text-white">{t.noteTitle}</h2>
              <p className="mt-2 leading-relaxed text-amber-100/80">{t.note}</p>

              <h2 className="mt-8 text-lg font-semibold text-white">{t.contactTitle}</h2>
              <p className="mt-2">
                {t.contact}{" "}
                <a href={`mailto:${EMAIL}`} className="text-sky-400 hover:text-sky-300">
                  {EMAIL}
                </a>
              </p>
            </section>
          );
        })}
      </div>
    </main>
  );
}
