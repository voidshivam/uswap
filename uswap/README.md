# USwap — Instant, Non-Custodial Crypto Exchange

A production-ready crypto swap app. React + Vite frontend, Node/Express
backend, integrated with the [ChangeNOW](https://changenow.io) exchange API.

Transactions are persisted in **SQLite**, swap creation is **idempotent**, and
read calls **retry** automatically. The UI is a clean, light, mobile-first
redesign with a friendly bear mascot.

```
uswap/
├── backend/      Express API — proxies ChangeNOW, SQLite persistence, idempotency
│   └── src/
│       ├── server.ts      HTTP routes, validation, idempotency, rate limits
│       ├── changenow.ts   ChangeNOW v2 client (implements SwapProvider)
│       ├── providers.ts   Provider registry — multi-provider seam
│       ├── store.ts       SQLite-backed transaction store + status refresher
│       ├── db.ts          better-sqlite3 schema + prepared statements
│       ├── http.ts        withRetry() helper for idempotent calls
│       ├── validation.ts  Input validators
│       ├── types.ts       Shared types + SwapProvider interface
│       └── backtest.ts    System backtest harness (npm run backtest)
└── frontend/     React + Vite + Tailwind — light UI, bear mascot
    └── src/
        ├── pages/         LandingPage, SwapPage, TrackPage
        ├── components/    Layout, Bear (mascot), ui/ primitives
        ├── hooks/         use-swap (React Query), use-debounce
        ├── store/         Zustand store (holds the clientTxId idempotency key)
        └── lib/           Typed API client
```

The frontend never holds your ChangeNOW API key. Every provider call goes
through the backend, which injects the key server-side.

## Setup

1. **Backend env** — copy and fill in:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Set `CHANGENOW_API_KEY` (required) and `CHANGENOW_AFFILIATE_ID` (this is
   what earns your commission). In production also set `NODE_ENV=production`
   and `CORS_ORIGIN` to your frontend domain.

2. **Install** (pnpm workspace):
   ```bash
   pnpm install
   ```

3. **Develop** — runs backend + frontend together:
   ```bash
   pnpm dev
   ```
   Frontend: http://localhost:5173 · Backend: http://localhost:3001

4. **Production build**:
   ```bash
   pnpm build      # builds backend (tsc) + frontend (vite)
   pnpm start      # runs the backend; serve frontend/dist on any static host
   ```

## Persistence

Transactions are stored in SQLite at `DATABASE_PATH` (default
`backend/data/uswap.db`). The file is created automatically. **Back it up** —
it is your swap history and recovery record. WAL mode is enabled, so it
tolerates concurrent reads safely.

## Idempotency

The frontend generates a UUID `clientTxId` per swap attempt and reuses it on
every retry. The backend dedupes within a 60-second window, so a double-tap or
a flaky-network retry returns the *same* transaction instead of creating a
second swap with a second deposit address.

## Retry behaviour

`getQuote`, `getStatus` and `getCoinList` retry twice (500 ms apart) on network
or 5xx errors, and never on 4xx. **`createTransaction` is never retried** —
retrying a create can mint a duplicate real swap.

## Backtest

```bash
cd backend && npm run backtest
```

Runs 17 checks against a mock provider: pair request-structure, idempotency,
persistence-across-restart, retry behaviour, and edge cases. No real crypto or
API key needed.

## Revenue

The only real revenue is the **ChangeNOW affiliate commission**, credited when
`CHANGENOW_AFFILIATE_ID` is set (passed as `userId` on each swap). There is no
hidden platform fee — the rate shown to users already includes network and
provider costs, and the UI says so honestly.
