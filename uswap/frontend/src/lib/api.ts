// Typed fetch client for the USwap backend.

import type { CoinInfo, SwapQuote, Transaction } from "@/types/swap";

const API_BASE = "/api";

class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: Record<string, unknown>;
  constructor(
    message: string,
    status: number,
    code?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiError(
        `Invalid server response (${res.status})`,
        res.status,
        "invalid_response",
      );
    }
  }

  if (!res.ok) {
    const obj = (body ?? {}) as {
      error?: string;
      code?: string;
      [k: string]: unknown;
    };
    throw new ApiError(
      obj.error ?? `Request failed (${res.status})`,
      res.status,
      obj.code,
      obj as Record<string, unknown>,
    );
  }
  return body as T;
}

export interface CreateTransactionInput {
  /** Client-generated idempotency key (UUID) — prevents duplicate swaps. */
  clientTxId: string;
  fromCoin: string;
  toCoin: string;
  fromNetwork: string;
  toNetwork: string;
  fromAmount: number;
  destinationAddress: string;
  destinationExtraId?: string | null;
  refundAddress?: string | null;
  refundExtraId?: string | null;
}

export const api = {
  health(): Promise<{
    ok: boolean;
    apiKeyConfigured: boolean;
    affiliateConfigured: boolean;
  }> {
    return request("/health");
  },
  getCoins(): Promise<CoinInfo[]> {
    return request("/coins");
  },
  getQuote(
    from: string,
    fromNetwork: string,
    to: string,
    toNetwork: string,
    amount: number,
  ): Promise<SwapQuote> {
    const qs = new URLSearchParams({
      from,
      fromNetwork,
      to,
      toNetwork,
      amount: String(amount),
    });
    return request(`/quote?${qs.toString()}`);
  },
  createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    return request("/transactions", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getTransaction(id: string): Promise<Transaction> {
    return request(`/transactions/${encodeURIComponent(id)}`);
  },
  refreshTransaction(id: string): Promise<Transaction> {
    return request(`/transactions/${encodeURIComponent(id)}/refresh`, {
      method: "POST",
    });
  },
};

export { ApiError };

// ── Display helpers ────────────────────────────────────────────────────────

export function formatAmount(amount: number, decimals = 8): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(decimals).replace(/\.?0+$/, "");
}

export function truncateAddress(address: string, chars = 6): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}
