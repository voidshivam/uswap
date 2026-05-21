// USwap backend — Express API in front of the swap provider(s).
//
// Endpoints:
//   GET  /api/health                      — server health
//   GET  /api/coins                       — list of supported coins
//   GET  /api/quote                       — get a swap quote (retried)
//   POST /api/transactions                — create a swap (idempotent)
//   GET  /api/transactions/:id            — read a tx (auto-refreshed)
//   POST /api/transactions/:id/refresh    — force-refresh a tx now
//
// All provider calls happen here — the frontend never sees the API key.
// Transactions are persisted in SQLite, so everything survives a restart.

import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";

import { ChangeNowClient, ChangeNowError } from "./changenow.js";
import { txdb } from "./db.js";
import { ProviderRegistry } from "./providers.js";
import { TransactionStore } from "./store.js";
import {
  isPositiveNumber,
  isValidAddress,
  isValidClientTxId,
  isValidExtraId,
  isValidNetwork,
  isValidSymbol,
} from "./validation.js";
import type { Transaction } from "./types.js";

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const PORT = Number.parseInt(process.env.PORT ?? "3001", 10);
const API_KEY = process.env.CHANGENOW_API_KEY ?? "";
const AFFILIATE_ID = process.env.CHANGENOW_AFFILIATE_ID ?? "";
const NODE_ENV = process.env.NODE_ENV ?? "development";

// CORS — in production CORS_ORIGIN must be set explicitly. Falls back to the
// local Vite dev origin only outside production.
const CORS_ORIGIN = (
  process.env.CORS_ORIGIN ??
  (NODE_ENV === "production" ? "" : "http://localhost:5173")
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Idempotency window — duplicate POSTs with the same clientTxId inside this
// window return the original transaction instead of creating a new swap.
const IDEMPOTENCY_WINDOW_MS = 60_000;

if (!API_KEY) {
  console.warn(
    "\n[warn] CHANGENOW_API_KEY is not set in .env — every swap request will fail.\n" +
      "       Copy backend/.env.example to backend/.env and fill it in.\n",
  );
}
if (!AFFILIATE_ID) {
  console.warn(
    "[warn] CHANGENOW_AFFILIATE_ID is not set — swaps will succeed but you earn 0% commission.",
  );
}
if (NODE_ENV === "production" && CORS_ORIGIN.length === 0) {
  console.warn(
    "[warn] NODE_ENV=production but CORS_ORIGIN is empty — set it to your frontend domain.",
  );
}

// Provider registry — one provider today, ready to grow.
const registry = new ProviderRegistry([
  new ChangeNowClient({ apiKey: API_KEY, affiliateId: AFFILIATE_ID }),
]);
const store = new TransactionStore(registry);
store.startAutoRefresh();

// ---------------------------------------------------------------------------
// Coin list cache — 10 minutes server-side.
// ---------------------------------------------------------------------------

interface CoinCache {
  data: unknown[];
  fetchedAt: number;
}
let coinCache: CoinCache | null = null;
const COIN_CACHE_MS = 10 * 60 * 1000;

async function getCachedCoins(): Promise<unknown[]> {
  const now = Date.now();
  if (coinCache && now - coinCache.fetchedAt < COIN_CACHE_MS) {
    return coinCache.data;
  }
  const fresh = await registry.getCoinList();
  coinCache = { data: fresh, fetchedAt: now };
  return fresh;
}

// ---------------------------------------------------------------------------
// Quote cache — 30s per (from+fromNet, to+toNet, amount-bucket).
// ---------------------------------------------------------------------------

interface QuoteCacheEntry {
  fromCoin: string;
  fromNetwork: string;
  toCoin: string;
  toNetwork: string;
  fromAmount: number;
  minAmount: number;
  maxAmount: number;
  toAmount: number;
  rate: number;
  estimatedDuration: string;
  fetchedAt: number;
}
const quoteCache = new Map<string, QuoteCacheEntry>();
const QUOTE_CACHE_MS = 30_000;

function quoteCacheKey(
  from: string,
  fromNet: string,
  to: string,
  toNet: string,
  amount: number,
): string {
  return (
    `${from.toUpperCase()}/${fromNet.toLowerCase()}:` +
    `${to.toUpperCase()}/${toNet.toLowerCase()}:${Math.floor(amount)}`
  );
}

async function getCachedQuote(
  from: string,
  fromNet: string,
  to: string,
  toNet: string,
  amount: number,
) {
  const key = quoteCacheKey(from, fromNet, to, toNet, amount);
  const now = Date.now();
  const cached = quoteCache.get(key);
  if (cached && now - cached.fetchedAt < QUOTE_CACHE_MS) return cached;

  const fresh = await registry.getQuote(from, fromNet, to, toNet, amount);
  const entry: QuoteCacheEntry = {
    fromCoin: from.toUpperCase(),
    fromNetwork: fromNet.toLowerCase(),
    toCoin: to.toUpperCase(),
    toNetwork: toNet.toLowerCase(),
    fromAmount: amount,
    minAmount: fresh.minAmount,
    maxAmount: fresh.maxAmount,
    toAmount: fresh.toAmount,
    rate: fresh.rate,
    estimatedDuration: fresh.estimatedDuration,
    fetchedAt: now,
  };
  quoteCache.set(key, entry);
  return entry;
}

// ---------------------------------------------------------------------------
// In-flight create guard — prevents a race where two identical requests both
// pass the DB dedup check before either has inserted its row.
// ---------------------------------------------------------------------------

const inFlightCreates = new Map<string, Promise<Transaction>>();

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
app.set("trust proxy", 1); // correct client IP behind a reverse proxy
app.use(express.json({ limit: "16kb" }));
app.use(
  cors({
    origin: CORS_ORIGIN.length > 0 ? CORS_ORIGIN : true,
    credentials: false,
  }),
);

// Rate limit — 60 req / min per IP.
app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests" },
  }),
);

// Stricter limit on transaction creation — 10/min.
app.use(
  "/api/transactions",
  rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many transaction creation requests" },
  }),
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    apiKeyConfigured: registry.isReady(),
    affiliateConfigured: AFFILIATE_ID.length > 0,
    provider: registry.primary()?.name ?? null,
    persistence: "sqlite",
  });
});

app.get("/api/coins", async (_req, res, next) => {
  try {
    if (!registry.isReady()) {
      res.status(503).json({ error: "Backend API key not configured" });
      return;
    }
    const coins = await getCachedCoins();
    res.json(coins);
  } catch (err) {
    next(err);
  }
});

app.get("/api/quote", async (req, res, next) => {
  try {
    const fromCoin = String(req.query.from ?? "");
    const fromNetwork = String(req.query.fromNetwork ?? "");
    const toCoin = String(req.query.to ?? "");
    const toNetwork = String(req.query.toNetwork ?? "");
    const amount = Number.parseFloat(String(req.query.amount ?? ""));

    if (!isValidSymbol(fromCoin)) {
      res.status(400).json({ error: "Invalid `from` symbol" });
      return;
    }
    if (!isValidSymbol(toCoin)) {
      res.status(400).json({ error: "Invalid `to` symbol" });
      return;
    }
    if (!isValidNetwork(fromNetwork)) {
      res.status(400).json({ error: "Missing or invalid `fromNetwork`" });
      return;
    }
    if (!isValidNetwork(toNetwork)) {
      res.status(400).json({ error: "Missing or invalid `toNetwork`" });
      return;
    }
    if (!isPositiveNumber(amount)) {
      res.status(400).json({ error: "Invalid `amount`" });
      return;
    }
    if (!registry.isReady()) {
      res.status(503).json({ error: "Backend API key not configured" });
      return;
    }

    const quote = await getCachedQuote(
      fromCoin,
      fromNetwork,
      toCoin,
      toNetwork,
      amount,
    );
    res.json({
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      rate: quote.rate,
      minAmount: quote.minAmount,
      maxAmount: quote.maxAmount,
      estimatedDuration: quote.estimatedDuration,
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/transactions", async (req, res, next) => {
  try {
    const {
      clientTxId,
      fromCoin,
      toCoin,
      fromNetwork,
      toNetwork,
      fromAmount,
      destinationAddress,
      destinationExtraId,
      refundAddress,
      refundExtraId,
    } = req.body as Partial<{
      clientTxId: string;
      fromCoin: string;
      toCoin: string;
      fromNetwork: string;
      toNetwork: string;
      fromAmount: number;
      destinationAddress: string;
      destinationExtraId: string | null;
      refundAddress: string | null;
      refundExtraId: string | null;
    }>;

    // --- Idempotency key (required) ---------------------------------------
    if (!isValidClientTxId(clientTxId)) {
      res.status(400).json({
        error: "Missing or invalid `clientTxId` (must be a UUID)",
        code: "invalid_client_tx_id",
      });
      return;
    }

    if (!isValidSymbol(fromCoin)) {
      res.status(400).json({ error: "Invalid `fromCoin`" });
      return;
    }
    if (!isValidSymbol(toCoin)) {
      res.status(400).json({ error: "Invalid `toCoin`" });
      return;
    }
    if (!isValidNetwork(fromNetwork)) {
      res.status(400).json({ error: "Missing or invalid `fromNetwork`" });
      return;
    }
    if (!isValidNetwork(toNetwork)) {
      res.status(400).json({ error: "Missing or invalid `toNetwork`" });
      return;
    }
    if (!isPositiveNumber(fromAmount)) {
      res.status(400).json({ error: "Invalid `fromAmount`" });
      return;
    }
    if (!isValidAddress(destinationAddress)) {
      res.status(400).json({ error: "Invalid `destinationAddress`" });
      return;
    }
    if (
      destinationExtraId != null &&
      destinationExtraId !== "" &&
      !isValidExtraId(destinationExtraId)
    ) {
      res.status(400).json({ error: "Invalid `destinationExtraId`" });
      return;
    }
    if (
      refundAddress != null &&
      refundAddress !== "" &&
      !isValidAddress(refundAddress)
    ) {
      res.status(400).json({ error: "Invalid `refundAddress`" });
      return;
    }
    if (
      refundExtraId != null &&
      refundExtraId !== "" &&
      !isValidExtraId(refundExtraId)
    ) {
      res.status(400).json({ error: "Invalid `refundExtraId`" });
      return;
    }
    if (!registry.isReady()) {
      res.status(503).json({ error: "Backend API key not configured" });
      return;
    }

    // --- Idempotency: already created? ------------------------------------
    const existing = store.findByClientTxId(clientTxId, IDEMPOTENCY_WINDOW_MS);
    if (existing) {
      res.status(200).json(existing);
      return;
    }
    // Same key still being processed in another request? Wait for it.
    const inFlight = inFlightCreates.get(clientTxId);
    if (inFlight) {
      const tx = await inFlight;
      res.status(200).json(tx);
      return;
    }

    // --- Create -----------------------------------------------------------
    const createPromise = (async (): Promise<Transaction> => {
      // minAmount / maxAmount check — fetches the quote (cached when possible)
      const quote = await getCachedQuote(
        fromCoin,
        fromNetwork,
        toCoin,
        toNetwork,
        fromAmount,
      );
      if (quote.minAmount > 0 && fromAmount < quote.minAmount) {
        throw new ChangeNowError(
          `Amount below minimum: ${quote.minAmount} ${fromCoin.toUpperCase()}`,
          400,
          "below_minimum",
        );
      }
      if (quote.maxAmount > 0 && fromAmount > quote.maxAmount) {
        throw new ChangeNowError(
          `Amount above maximum: ${quote.maxAmount} ${fromCoin.toUpperCase()}`,
          400,
          "above_maximum",
        );
      }

      const { provider, result } = await registry.createTransaction({
        fromCoin,
        toCoin,
        fromNetwork,
        toNetwork,
        fromAmount,
        destinationAddress,
        destinationExtraId: destinationExtraId ?? null,
        refundAddress: refundAddress ?? null,
        refundExtraId: refundExtraId ?? null,
      });

      const now = Date.now();
      const tx: Transaction = {
        id: result.providerTxId,
        clientTxId,
        provider,
        providerTxId: result.providerTxId,
        fromCoin: fromCoin.toUpperCase(),
        toCoin: toCoin.toUpperCase(),
        fromNetwork: fromNetwork.toLowerCase(),
        toNetwork: toNetwork.toLowerCase(),
        fromAmount,
        toAmount: result.toAmount,
        depositAddress: result.depositAddress,
        depositExtraId: result.depositExtraId,
        destinationAddress,
        destinationExtraId: destinationExtraId ?? null,
        status: "Waiting",
        createdAt: now,
        updatedAt: now,
      };
      store.put(tx);
      return tx;
    })();

    inFlightCreates.set(clientTxId, createPromise);
    try {
      const tx = await createPromise;
      res.status(201).json(tx);
    } finally {
      inFlightCreates.delete(clientTxId);
    }
  } catch (err) {
    next(err);
  }
});

app.get("/api/transactions/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const cached = store.get(id);
    if (!cached) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    // Fire-and-forget refresh so the next poll sees a fresh status.
    void store.refresh(id);
    res.json(cached);
  } catch (err) {
    next(err);
  }
});

app.post("/api/transactions/:id/refresh", async (req, res, next) => {
  try {
    const id = req.params.id;
    const tx = await store.refresh(id);
    if (!tx) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    res.json(tx);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ChangeNowError) {
    res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({
      error: err.message,
      code: err.code,
    });
    return;
  }
  console.error("[server] unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ---------------------------------------------------------------------------
// Listen
// ---------------------------------------------------------------------------

const server = app.listen(PORT, () => {
  console.log(`[server] USwap API listening on port ${PORT}`);
  console.log(
    `[server] env: ${NODE_ENV}, persistence: sqlite, ` +
      `API key: ${registry.isReady() ? "configured" : "MISSING"}, ` +
      `affiliate: ${AFFILIATE_ID.length > 0 ? "configured" : "missing"}`,
  );
});

function shutdown() {
  store.stopAutoRefresh();
  server.close(() => {
    txdb.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
