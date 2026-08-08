"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export const NAV_DRAWER_WIDTH = 224;

const NAV_LINKS = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9.75L12 3l9 6.75V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.75Z" />
        <path d="M9 22V12h6v10" />
      </svg>
    ),
  },
  {
    href: "/about",
    label: "About Us",
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  {
    href: "/article",
    label: "Article",
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    ),
  },
];

type NavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hidden?: boolean;
};
/**
 * Hamburger button + slide-in overlay drawer from the right.
 * The map stays still; the drawer overlays on top with a dark backdrop.
 */
export default function NavDrawer({ open, onOpenChange, hidden = false }: NavDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!drawerRef.current?.contains(e.target as Node)) {
        onOpenChange(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  return (
    <>
      {/* ── Hamburger trigger ── */}
      <button
        type="button"
        id="nav-drawer-toggle"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label="Open navigation menu"
        title="Navigation"
        className={`fixed right-2 top-2 md:right-4 md:top-4 z-40 flex h-9 w-9 md:h-10 md:w-10 flex-col items-center justify-center gap-[5px] rounded-lg border backdrop-blur shadow-lg transition-all select-none ${open || hidden ? "opacity-0 pointer-events-none scale-90" : "border-white/10 bg-black/60 text-white/80 hover:bg-white/10"
          }`}
      >
        <span
          className={`block h-[2px] w-5 rounded-full bg-current transition-transform duration-300 origin-center ${open ? "translate-y-[7px] rotate-45" : ""
            }`}
        />
        <span
          className={`block h-[2px] w-5 rounded-full bg-current transition-opacity duration-200 ${open ? "opacity-0" : "opacity-100"
            }`}
        />
        <span
          className={`block h-[2px] w-5 rounded-full bg-current transition-transform duration-300 origin-center ${open ? "-translate-y-[7px] -rotate-45" : ""
            }`}
        />
      </button>

      {/* ── Sidebar — fixed to the right edge, slides in, pushes nothing
           itself (the parent's content wrapper shrinks to make room) ── */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="false"
        aria-label="Navigation menu"
        className={`fixed right-0 top-0 z-30 flex h-full w-full md:w-56 flex-col bg-[#0b1622] border-l border-white/10 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${open ? "translate-x-0" : "translate-x-full"
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 shadow-lg shadow-sky-500/30">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white" fill="currentColor">
                <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2a1.5 1.5 0 0 0-1.5 1.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">Point Travel</p>
              <p className="text-[10px] text-white/40 leading-tight">Live Flight Map</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close navigation menu"
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-0.5 px-2 py-3">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
            Menu
          </p>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => onOpenChange(false)}
              className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/75 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98]"
            >
              <span className="text-white/50 group-hover:text-sky-400 transition-colors">
                {link.icon}
              </span>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Footer — pinned to the bottom now that it's full height */}
        <div className="mt-auto px-4 py-3 border-t border-white/10">
          <p className="text-[11px] text-white/25 text-center">
            © {new Date().getFullYear()} Point Travel
          </p>
        </div>
      </div>
    </>
  );
}
