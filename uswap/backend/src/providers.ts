// Provider registry — the seam for multi-provider support.
//
// Today there is one provider (ChangeNOW). The registry holds an ordered list
// and exposes the "primary" (first ready) provider. When a second provider is
// added later, read-only calls can fall back to the next provider in line if
// the primary fails — without touching any route code.
//
// createTransaction deliberately does NOT fall back: a create that partially
// succeeded on provider A must not be retried on provider B.

import type {
  CoinInfo,
  CreateTransactionInput,
  CreateTransactionResult,
  StatusResult,
  SwapProvider,
  SwapQuote,
} from "./types.js";

export class ProviderRegistry {
  private readonly providers: SwapProvider[];

  constructor(providers: SwapProvider[]) {
    this.providers = providers;
  }

  /** First provider that has credentials configured. */
  primary(): SwapProvider | undefined {
    return this.providers.find((p) => p.isReady());
  }

  isReady(): boolean {
    return this.primary() !== undefined;
  }

  /** Every ready provider, in priority order. */
  private ready(): SwapProvider[] {
    return this.providers.filter((p) => p.isReady());
  }

  private requirePrimary(): SwapProvider {
    const p = this.primary();
    if (!p) throw new Error("No swap provider is configured");
    return p;
  }

  // --- Read-only: try primary, fall back to the next ready provider --------

  async getCoinList(): Promise<CoinInfo[]> {
    return this.readWithFallback((p) => p.getCoinList(), "getCoinList");
  }

  async getQuote(
    fromCoin: string,
    fromNetwork: string,
    toCoin: string,
    toNetwork: string,
    amount: number,
  ): Promise<SwapQuote> {
    return this.readWithFallback(
      (p) => p.getQuote(fromCoin, fromNetwork, toCoin, toNetwork, amount),
      "getQuote",
    );
  }

  // --- Create: primary only, NO fallback (money safety) --------------------

  async createTransaction(
    input: CreateTransactionInput,
  ): Promise<{ provider: string; result: CreateTransactionResult }> {
    const provider = this.requirePrimary();
    const result = await provider.createTransaction(input);
    return { provider: provider.name, result };
  }

  // --- Status: route to the provider that owns the tx ----------------------

  async getStatus(
    providerName: string,
    providerTxId: string,
  ): Promise<StatusResult> {
    const provider =
      this.providers.find((p) => p.name === providerName) ??
      this.requirePrimary();
    return provider.getStatus(providerTxId);
  }

  private async readWithFallback<T>(
    fn: (p: SwapProvider) => Promise<T>,
    label: string,
  ): Promise<T> {
    const ready = this.ready();
    if (ready.length === 0) throw new Error("No swap provider is configured");

    let lastErr: unknown;
    for (const provider of ready) {
      try {
        return await fn(provider);
      } catch (err) {
        lastErr = err;
        console.warn(
          `[registry] ${label} failed on ${provider.name}, trying next provider`,
        );
      }
    }
    throw lastErr;
  }
}
