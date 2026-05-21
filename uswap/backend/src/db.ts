// SQLite persistence layer (better-sqlite3).
//
// Replaces the old in-memory Map. Transactions now survive process restarts,
// so users never lose their swap history or tracking ability.
//
// The DB file path is configurable via DATABASE_PATH; defaults to ./data/uswap.db.
// better-sqlite3 is synchronous — that's intentional and fine here: SQLite
// writes are sub-millisecond and this avoids a whole class of async race bugs.

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";

import type { Transaction, TransactionStatus } from "./types.js";

const DB_PATH = resolve(process.env.DATABASE_PATH ?? "./data/uswap.db");

// Ensure the parent directory exists before opening the file.
const dir = dirname(DB_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL"); // concurrent reads + durable writes
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id                  TEXT PRIMARY KEY,
    client_tx_id        TEXT,
    provider            TEXT NOT NULL DEFAULT 'changenow',
    provider_tx_id      TEXT NOT NULL,
    from_coin           TEXT NOT NULL,
    to_coin             TEXT NOT NULL,
    from_network        TEXT NOT NULL,
    to_network          TEXT NOT NULL,
    from_amount         REAL NOT NULL,
    to_amount           REAL NOT NULL,
    deposit_address     TEXT NOT NULL,
    deposit_extra_id    TEXT,
    destination_address TEXT NOT NULL,
    destination_extra_id TEXT,
    status              TEXT NOT NULL,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tx_client_id  ON transactions(client_tx_id);
  CREATE INDEX IF NOT EXISTS idx_tx_status     ON transactions(status);
  CREATE INDEX IF NOT EXISTS idx_tx_created_at ON transactions(created_at);
`);

// ---------------------------------------------------------------------------
// Row <-> Transaction mapping
// ---------------------------------------------------------------------------

interface TxRow {
  id: string;
  client_tx_id: string | null;
  provider: string;
  provider_tx_id: string;
  from_coin: string;
  to_coin: string;
  from_network: string;
  to_network: string;
  from_amount: number;
  to_amount: number;
  deposit_address: string;
  deposit_extra_id: string | null;
  destination_address: string;
  destination_extra_id: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

function rowToTx(row: TxRow): Transaction {
  return {
    id: row.id,
    clientTxId: row.client_tx_id,
    provider: row.provider,
    providerTxId: row.provider_tx_id,
    fromCoin: row.from_coin,
    toCoin: row.to_coin,
    fromNetwork: row.from_network,
    toNetwork: row.to_network,
    fromAmount: row.from_amount,
    toAmount: row.to_amount,
    depositAddress: row.deposit_address,
    depositExtraId: row.deposit_extra_id,
    destinationAddress: row.destination_address,
    destinationExtraId: row.destination_extra_id,
    status: row.status as TransactionStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Prepared statements (compiled once, reused — fast)
// ---------------------------------------------------------------------------

const stmtInsert = db.prepare(`
  INSERT INTO transactions (
    id, client_tx_id, provider, provider_tx_id,
    from_coin, to_coin, from_network, to_network,
    from_amount, to_amount, deposit_address, deposit_extra_id,
    destination_address, destination_extra_id,
    status, created_at, updated_at
  ) VALUES (
    @id, @client_tx_id, @provider, @provider_tx_id,
    @from_coin, @to_coin, @from_network, @to_network,
    @from_amount, @to_amount, @deposit_address, @deposit_extra_id,
    @destination_address, @destination_extra_id,
    @status, @created_at, @updated_at
  )
`);

const stmtGetById = db.prepare(`SELECT * FROM transactions WHERE id = ?`);

const stmtUpdateStatus = db.prepare(`
  UPDATE transactions
  SET status = @status, to_amount = @to_amount, updated_at = @updated_at
  WHERE id = @id
`);

const stmtFindRecentByClientId = db.prepare(`
  SELECT * FROM transactions
  WHERE client_tx_id = ? AND created_at >= ?
  ORDER BY created_at DESC
  LIMIT 1
`);

const stmtListPending = db.prepare(`
  SELECT * FROM transactions
  WHERE status NOT IN ('Finished', 'Failed', 'Refunded', 'Expired')
  ORDER BY created_at ASC
`);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const txdb = {
  /** Insert a brand-new transaction. Throws if the id already exists. */
  insert(tx: Transaction): void {
    stmtInsert.run({
      id: tx.id,
      client_tx_id: tx.clientTxId ?? null,
      provider: tx.provider,
      provider_tx_id: tx.providerTxId,
      from_coin: tx.fromCoin,
      to_coin: tx.toCoin,
      from_network: tx.fromNetwork,
      to_network: tx.toNetwork,
      from_amount: tx.fromAmount,
      to_amount: tx.toAmount,
      deposit_address: tx.depositAddress,
      deposit_extra_id: tx.depositExtraId ?? null,
      destination_address: tx.destinationAddress,
      destination_extra_id: tx.destinationExtraId ?? null,
      status: tx.status,
      created_at: tx.createdAt,
      updated_at: tx.updatedAt,
    });
  },

  /** Fetch one transaction by its id. */
  get(id: string): Transaction | undefined {
    const row = stmtGetById.get(id) as TxRow | undefined;
    return row ? rowToTx(row) : undefined;
  },

  /** Persist a status / toAmount change. */
  updateStatus(id: string, status: TransactionStatus, toAmount: number): void {
    stmtUpdateStatus.run({
      id,
      status,
      to_amount: toAmount,
      updated_at: Date.now(),
    });
  },

  /**
   * Idempotency lookup: find a transaction created with the same clientTxId
   * inside the dedup window. Returns the existing tx if found, so a duplicate
   * POST returns the same deposit address instead of creating a new swap.
   */
  findRecentByClientId(
    clientTxId: string,
    windowMs: number,
  ): Transaction | undefined {
    const since = Date.now() - windowMs;
    const row = stmtFindRecentByClientId.get(clientTxId, since) as
      | TxRow
      | undefined;
    return row ? rowToTx(row) : undefined;
  },

  /** All transactions not yet in a terminal state — used by the refresher. */
  listPending(): Transaction[] {
    const rows = stmtListPending.all() as TxRow[];
    return rows.map(rowToTx);
  },

  /** Close the DB handle (called on shutdown). */
  close(): void {
    db.close();
  },
};
