// ChangeNOW v2 API client — implements the SwapProvider interface.
//
// Wires `fromNetwork` / `toNetwork` through every endpoint (estimated-amount,
// range, exchange) — without these, multi-network coins like USDT/USDC/ETH
// silently default and can route deposits to the wrong chain.
//
// Read-only calls (getQuote, getStatus, getCoinList) are wrapped in withRetry
// — 2 retries, 500ms delay. createTransaction is NEVER retried: retrying a
// create can mint a second real swap with a second deposit address.

import { withRetry } from "./http.js";
import type {
  CoinInfo,
  CreateTransactionInput,
  CreateTransactionResult,
  StatusResult,
  SwapProvider,
  SwapQuote,
  TransactionStatus,
} from "./types.js";
import { TERMINAL_STATUSES } from "./types.js";

const BASE_URL = "https://api.changenow.io/v2";

// Chains that require a destination tag / memo on receive.
const EXTRA_ID_CHAINS = new Set<string>([
  "xrp",
  "xlm",
  "eos",
  "atom",
  "ton",
  "bnb", // legacy BEP2
  "hbar",
  "iota",
  "miota",
  "nano",
  "bts",
  "steem",
  "hive",
  "xem",
  "xmr", // payment id (optional but supported)
]);

class ChangeNowError extends Error {
  public readonly status: number;
  public readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ClientConfig {
  apiKey: string;
  affiliateId: string;
}

interface RawEstimatedAmount {
  fromAmount?: number | string;
  toAmount?: number | string;
  estimatedAmount?: number | string;
  transactionSpeedForecast?: string;
  warningMessage?: string | null;
}

interface RawMinMax {
  minAmount: number | string;
  maxAmount: number | string | null;
}

interface RawCreateResponse {
  id: string;
  fromAmount: number | string;
  toAmount: number | string;
  payinAddress: string;
  payinExtraId?: string | null;
  payoutAddress: string;
  payoutExtraId?: string | null;
  refundAddress?: string;
  refundExtraId?: string | null;
  fromCurrency: string;
  fromNetwork?: string;
  toCurrency: string;
  toNetwork?: string;
}

interface RawStatusResponse {
  id: string;
  status: string;
  amountFrom: number | string;
  amountTo: number | string;
  payinAddress: string;
  payoutAddress: string;
  updatedAt: string;
}

interface RawCurrency {
  ticker: string;
  name: string;
  network?: string;
  image?: string;
  supportsFixedRate?: boolean;
  isAvailable?: boolean;
  hasExternalId?: boolean;
  legacyTicker?: string;
}

function toNumber(v: number | string | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapStatus(raw: string): TransactionStatus {
  switch (raw.toLowerCase()) {
    case "waiting":
      return "Waiting";
    case "confirming":
      return "Confirming";
    case "exchanging":
      return "Exchanging";
    case "sending":
      return "Sending";
    case "finished":
      return "Finished";
    case "failed":
      return "Failed";
    case "refunded":
      return "Refunded";
    case "expired":
      return "Expired";
    default:
      return "Waiting";
  }
}

// A 4xx client error (bad pair, bad amount) won't fix itself on retry.
// Only retry network failures and 5xx server errors.
function isRetryableError(err: unknown): boolean {
  if (err instanceof ChangeNowError) {
    return err.status >= 500 || err.status === 0 || err.status === 429;
  }
  return true; // network/timeout errors — worth retrying
}

async function changenowRequest<T>(
  apiKey: string,
  path: string,
  init?: RequestInit & { rawJson?: unknown },
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "x-changenow-api-key": apiKey,
  };
  const body = init?.rawJson;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? (body !== undefined ? "POST" : "GET"),
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // Network-level failure — give it status 0 so retry logic kicks in.
    throw new ChangeNowError(
      `Network error reaching ChangeNOW: ${(err as Error).message}`,
      0,
      "network_error",
    );
  }

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new ChangeNowError(
      `Invalid JSON from ChangeNOW: ${text.slice(0, 200)}`,
      res.status,
      "invalid_response",
    );
  }

  if (!res.ok) {
    const obj = parsed as { error?: string; message?: string };
    const code = obj?.error ?? "unknown_error";
    const msg = obj?.message ?? `ChangeNOW request failed (${res.status})`;
    throw new ChangeNowError(msg, res.status, code);
  }

  // Some ChangeNOW endpoints return { error, message } with HTTP 200.
  if (parsed && typeof parsed === "object" && "error" in parsed) {
    const obj = parsed as { error?: string; message?: string };
    if (obj.error) {
      throw new ChangeNowError(
        obj.message ?? `ChangeNOW error: ${obj.error}`,
        res.status,
        obj.error,
      );
    }
  }

  return parsed as T;
}

export class ChangeNowClient implements SwapProvider {
  public readonly name = "changenow";
  private readonly apiKey: string;
  private readonly affiliateId: string;

  constructor(config: ClientConfig) {
    this.apiKey = config.apiKey;
    this.affiliateId = config.affiliateId;
  }

  isReady(): boolean {
    return this.apiKey.length > 0;
  }

  async getCoinList(): Promise<CoinInfo[]> {
    const raw = await withRetry(
      () =>
        changenowRequest<RawCurrency[]>(
          this.apiKey,
          "/exchange/currencies?active=true&flow=standard",
        ),
      { label: "getCoinList", isRetryable: isRetryableError },
    );
    return raw
      .filter((c) => c.isAvailable !== false)
      .map((c) => {
        const network = (c.network ?? "").toLowerCase();
        const symbol = (c.ticker ?? "").toUpperCase();
        return {
          symbol,
          name: c.name ?? c.ticker ?? "",
          network,
          logoUrl: c.image ?? "",
          hasExtraId:
            c.hasExternalId === true ||
            EXTRA_ID_CHAINS.has(network) ||
            EXTRA_ID_CHAINS.has(symbol.toLowerCase()),
        };
      })
      .filter((c) => c.symbol.length > 0);
  }

  async getQuote(
    fromCoin: string,
    fromNetwork: string,
    toCoin: string,
    toNetwork: string,
    amount: number,
  ): Promise<SwapQuote> {
    const params = (extra?: Record<string, string>) =>
      new URLSearchParams({
        fromCurrency: fromCoin.toLowerCase(),
        toCurrency: toCoin.toLowerCase(),
        fromNetwork: fromNetwork.toLowerCase(),
        toNetwork: toNetwork.toLowerCase(),
        flow: "standard",
        ...(extra ?? {}),
      });

    // 1) estimated amount — retried
    const estimate = await withRetry(
      () =>
        changenowRequest<RawEstimatedAmount>(
          this.apiKey,
          `/exchange/estimated-amount?${params({ fromAmount: String(amount) }).toString()}`,
        ),
      { label: "getQuote:estimate", isRetryable: isRetryableError },
    );
    const rawToAmount = toNumber(estimate.toAmount ?? estimate.estimatedAmount, 0);

    // 2) min/max — retried
    const range = await withRetry(
      () =>
        changenowRequest<RawMinMax>(
          this.apiKey,
          `/exchange/range?${params().toString()}`,
        ),
      { label: "getQuote:range", isRetryable: isRetryableError },
    );

    const rate = amount > 0 ? rawToAmount / amount : 0;

    return {
      fromAmount: amount,
      toAmount: rawToAmount,
      rate,
      minAmount: toNumber(range.minAmount, 0),
      maxAmount: toNumber(range.maxAmount, 0),
      estimatedDuration: estimate.transactionSpeedForecast ?? "5-30 minutes",
    };
  }

  /**
   * Create a transaction. NOT wrapped in withRetry — retrying a create can
   * produce two distinct real swaps with two deposit addresses. Idempotency
   * is enforced one layer up (clientTxId dedup in the server).
   *
   * Validates the returned deposit address is non-empty. If empty, throws
   * — never returns a transaction the user could send funds to in vain.
   */
  async createTransaction(
    input: CreateTransactionInput,
  ): Promise<CreateTransactionResult> {
    const body: Record<string, unknown> = {
      fromCurrency: input.fromCoin.toLowerCase(),
      toCurrency: input.toCoin.toLowerCase(),
      fromNetwork: input.fromNetwork.toLowerCase(),
      toNetwork: input.toNetwork.toLowerCase(),
      fromAmount: String(input.fromAmount), // v2 expects a string
      address: input.destinationAddress,
      flow: "standard",
      type: "direct",
    };
    if (input.destinationExtraId && input.destinationExtraId.length > 0) {
      body.extraId = input.destinationExtraId;
    }
    if (input.refundAddress && input.refundAddress.length > 0) {
      body.refundAddress = input.refundAddress;
    }
    if (input.refundExtraId && input.refundExtraId.length > 0) {
      body.refundExtraId = input.refundExtraId;
    }
    if (this.affiliateId.length > 0) {
      // ChangeNOW affiliate tracking field — commission credited per swap.
      body.userId = this.affiliateId;
    }

    const result = await changenowRequest<RawCreateResponse>(
      this.apiKey,
      "/exchange",
      { method: "POST", rawJson: body },
    );

    if (!result.payinAddress || result.payinAddress.trim().length === 0) {
      throw new ChangeNowError(
        "Provider returned an empty deposit address. Refusing to create transaction.",
        502,
        "empty_deposit_address",
      );
    }
    if (!result.id || result.id.trim().length === 0) {
      throw new ChangeNowError(
        "Provider returned no transaction id.",
        502,
        "missing_tx_id",
      );
    }

    return {
      providerTxId: result.id,
      depositAddress: result.payinAddress,
      depositExtraId:
        result.payinExtraId && String(result.payinExtraId).trim().length > 0
          ? String(result.payinExtraId)
          : null,
      toAmount: toNumber(result.toAmount, input.fromAmount),
    };
  }

  async getStatus(providerTxId: string): Promise<StatusResult> {
    const result = await withRetry(
      () =>
        changenowRequest<RawStatusResponse>(
          this.apiKey,
          `/exchange/by-id?id=${encodeURIComponent(providerTxId)}`,
        ),
      { label: "getStatus", isRetryable: isRetryableError },
    );
    return {
      status: mapStatus(result.status ?? "waiting"),
      amountFrom: toNumber(result.amountFrom, 0),
      amountTo: toNumber(result.amountTo, 0),
    };
  }
}

export { ChangeNowError, TERMINAL_STATUSES };
