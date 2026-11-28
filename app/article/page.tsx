import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Articles · Point Travel",
  description: "Articles from Point Travel are coming soon.",
};

// Placeholder so the nav link doesn't 404 until real articles exist.
export default function ArticlePage() {
  return (
    <main className="h-dvh overflow-y-auto bg-[#0b1622] text-white/85">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <nav className="mb-8 text-sm">
          <Link href="/" className="text-sky-400 hover:text-sky-300">
            ← Back to map
          </Link>
        </nav>

        <section lang="en" className="mb-10">
          <h1 className="text-2xl font-semibold text-white">Articles</h1>
          <p className="mt-4 leading-relaxed">
            No articles yet. They are coming soon.
          </p>
        </section>

        <section lang="id" className="border-t border-white/10 pt-10">
          <h1 className="text-2xl font-semibold text-white">Artikel</h1>
          <p className="mt-4 leading-relaxed">
            Belum ada artikel. Segera hadir.
          </p>
        </section>

        <p className="mt-10 text-sm text-white/50">
          <Link href="/about" className="text-sky-400 hover:text-sky-300">
            About Point Travel
          </Link>
        </p>
      </div>
    </main>
  );
}
