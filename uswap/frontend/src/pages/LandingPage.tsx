import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Bear } from "@/components/Bear";

const TRUST = [
  {
    icon: Lock,
    title: "Non-custodial swaps",
    body: "Funds move wallet-to-wallet. USwap never holds, freezes, or controls your crypto.",
  },
  {
    icon: ShieldCheck,
    title: "No hidden fees",
    body: "The rate you see already includes network and provider costs. No surprise deductions.",
  },
  {
    icon: Zap,
    title: "Instant & accountless",
    body: "No sign-up, no KYC for standard swaps. Pick a pair, send, receive — usually in minutes.",
  },
];

const STEPS = [
  { n: "1", t: "Choose your pair", d: "Pick the coin and network you send and receive." },
  { n: "2", t: "Send your deposit", d: "Transfer to the address we generate for you." },
  { n: "3", t: "Receive automatically", d: "The swap settles to your wallet. Track it live." },
];

export function LandingPage() {
  return (
    <div className="flex-1 bg-mesh">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 pt-14 pb-20 sm:pt-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-50 text-mint-700 px-3 py-1 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Hundreds of coins, one friendly swap
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold leading-[1.08] tracking-tight text-ink">
              Swap crypto in minutes —{" "}
              <span className="text-gradient">no account, no fuss</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate leading-relaxed max-w-md">
              USwap is a non-custodial exchange. Choose a pair, send your
              deposit, and receive the swap straight to your wallet. That's it.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/swap"
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo text-white font-semibold px-6 h-13 shadow-glow hover:bg-indigo-700 hover:shadow-lift transition-all active:scale-[0.98]"
              >
                Start a swap
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/track"
                search={{ id: undefined }}
                className="inline-flex items-center gap-2 rounded-2xl bg-white border border-line text-ink font-semibold px-6 h-13 hover:border-indigo/40 hover:bg-indigo-50/50 transition-all"
              >
                Track a transaction
              </Link>
            </div>
          </div>

          {/* Mascot */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              <div className="absolute inset-0 -m-8 rounded-full bg-indigo-100/60 blur-2xl" />
              <div className="relative bg-white rounded-3xl shadow-lift border border-line p-10 animate-fade-up">
                <Bear mood="happy" size={200} float />
                <div className="mt-4 text-center">
                  <p className="font-bold text-ink">Hi, I'm Kuma 🐻</p>
                  <p className="text-sm text-mist mt-0.5">
                    I'll keep your swap on track.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust ────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 pb-16">
        <div className="grid sm:grid-cols-3 gap-4">
          {TRUST.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="bg-white rounded-2xl border border-line p-6 shadow-soft hover:shadow-lift transition-shadow"
            >
              <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Icon className="w-5 h-5 text-indigo" />
              </div>
              <h3 className="mt-4 font-bold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm text-slate leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 pb-24">
        <div className="bg-white rounded-3xl border border-line shadow-soft p-8 sm:p-10">
          <h2 className="text-2xl font-extrabold text-ink tracking-tight">
            How it works
          </h2>
          <p className="mt-1 text-slate">Three steps, no learning curve.</p>
          <div className="mt-8 grid sm:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <div className="w-9 h-9 rounded-full bg-indigo text-white font-bold text-sm flex items-center justify-center">
                  {s.n}
                </div>
                <h3 className="mt-3 font-bold text-ink">{s.t}</h3>
                <p className="mt-1 text-sm text-slate leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-9">
            <Link
              to="/swap"
              className="inline-flex items-center gap-2 rounded-2xl bg-mint text-white font-semibold px-6 h-12 shadow-glow-mint hover:bg-mint-700 transition-all active:scale-[0.98]"
            >
              Try it now
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
