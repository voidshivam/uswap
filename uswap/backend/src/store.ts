// SQLite-backed transaction store + background status refresher.
//
// All transactions are persisted via the txdb layer, so they survive process
// restarts — users keep their swap history and tracking. The refresher polls
// non-terminal transactions and writes status changes straight to SQLite.

import { txdb } from "./db.js";
import type { ProviderRegistry } from "./providers.js";
import type { Transaction } from "./types.js";
import { TERMINAL_STATUSES } from "./types.js";

export class TransactionStore {
  private readonly registry: ProviderRegistry;
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly refreshIntervalMs: number;

  constructor(registry: ProviderRegistry, refreshIntervalMs = 20_000) {
    this.registry = registry;
    this.refreshIntervalMs = refreshIntervalMs;
  }

  /** Persist a new transaction. */
  put(tx: Transaction): void {
    txdb.insert(tx);
  }

  /** Read a transaction from the database. */
  get(id: string): Transaction | undefined {
    return txdb.get(id);
  }

  /**
   * Idempotency lookup. Returns an existing transaction created with the same
   * clientTxId inside `windowMs` — so a duplicate request returns the original
   * deposit address instead of creating a second swap.
   */
  findByClientTxId(
    clientTxId: string,
    windowMs: number,
  ): Transaction | undefined {
    return txdb.findRecentByClientId(clientTxId, windowMs);
  }

  /**
   * Refresh a single transaction's status from its provider.
   * Skips the API call if the transaction is already terminal.
   */
  async refresh(id: string): Promise<Transaction | undefined> {
    const tx = txdb.get(id);
    if (!tx) return undefined;
    if (TERMINAL_STATUSES.includes(tx.status)) return tx;
    if (!this.registry.isReady()) return tx;

    try {
      const { status, amountTo } = await this.registry.getStatus(
        tx.provider,
        tx.providerTxId,
      );
      const nextToAmount = amountTo > 0 ? amountTo : tx.toAmount;
      // Only write if something actually changed — keeps WAL churn low.
      if (status !== tx.status || nextToAmount !== tx.toAmount) {
        txdb.updateStatus(id, status, nextToAmount);
      }
      return txdb.get(id);
    } catch (err) {
      // Transient provider error — keep last known state.
      console.error(`[store] refresh failed for ${id}:`, err);
      return tx;
    }
  }

  /** Start the background refresh loop. */
  startAutoRefresh(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setInterval(() => {
      void this.refreshAllPending();
    }, this.refreshIntervalMs);
  }

  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async refreshAllPending(): Promise<void> {
    if (!this.registry.isReady()) return;
    const pending = txdb.listPending();
    // Sequential with a small gap — never hammer the provider.
    for (const tx of pending) {
      await this.refresh(tx.id);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}
