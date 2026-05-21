import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Search, Repeat2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { to: "/swap", label: "Swap", icon: Repeat2 },
  { to: "/track", label: "Track", icon: Search },
] as const;

function BearMark() {
  // Compact mascot mark for the header — pure SVG, ~1KB.
  return (
    <svg width="32" height="32" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#5B6EFF" />
      <circle cx="22" cy="22" r="8" fill="#EEF0FF" />
      <circle cx="42" cy="22" r="8" fill="#EEF0FF" />
      <circle cx="32" cy="34" r="20" fill="#EEF0FF" />
      <ellipse cx="32" cy="40" rx="9" ry="7" fill="#fff" />
      <ellipse cx="32" cy="36" rx="3" ry="2.2" fill="#5B6EFF" />
      <circle cx="25" cy="30" r="2.6" fill="#1A1D2E" />
      <circle cx="39" cy="30" r="2.6" fill="#1A1D2E" />
      <path
        d="M28 42 q4 4 8 0"
        stroke="#1A1D2E"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Layout() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="sticky top-0 z-40 bg-canvas/85 backdrop-blur-md border-b border-line/70">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="transition-transform group-hover:-rotate-6">
              <BearMark />
            </span>
            <span className="font-extrabold text-lg tracking-tight text-ink">
              U<span className="text-indigo">Swap</span>
            </span>
          </Link>

          <nav
            className="flex items-center gap-1 bg-white rounded-full p-1 border border-line shadow-soft"
            aria-label="Main navigation"
          >
            {NAV_LINKS.map(({ to, label, icon: Icon }) => {
              const isActive = pathname.startsWith(to);
              const cls = cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all",
                isActive
                  ? "bg-indigo text-white shadow-glow"
                  : "text-slate hover:text-ink hover:bg-line/50",
              );
              // /track carries an optional search param — pass it explicitly.
              return to === "/track" ? (
                <Link key={to} to={to} search={{ id: undefined }} className={cls}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              ) : (
                <Link key={to} to={to} className={cls}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      <footer className="border-t border-line/70 mt-auto">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-mist">
          <span>© {new Date().getFullYear()} USwap · Instant crypto exchange</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-mint" />
            Non-custodial · Powered by ChangeNOW
          </span>
        </div>
      </footer>
    </div>
  );
}
