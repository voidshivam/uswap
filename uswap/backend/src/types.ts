export type TransactionStatus =
  | "Waiting"
  | "Confirming"
  | "Exchanging"
  | "Sending"
  | "Finished"
  | "Failed"
  | "Refunded"
  | "Expired";

export const TERMINAL_STATUSES: TransactionStatus[] = [
  "Finished",
  "Failed",
  "Refunded",
  "Expired",
];

export interface CoinInfo {
  symbol: string;
  name: string;
  network: string;
  logoUrl: string;
  hasExtraId?: boolean; // tag/memo-required chain (XRP, XLM, EOS, ATOM, TON…)
}

export interface SwapQuote {
  fromAmount: number;
  toAmount: number;
  rate: number;
  minAmount: number;
  maxAmount: number;
  estimatedDuration: string;
}

export interface Transaction {
  id: string;
  /** Client-generated idempotency key (UUID). Null for legacy rows. */
  clientTxId: string | null;
  /** Which provider fulfilled this swap (changenow, …). */
  provider: string;
  providerTxId: string;
  fromCoin: string;
  toCoin: string;
  fromNetwork: string;
  toNetwork: string;
  fromAmount: number;
  toAmount: number;
  depositAddress: string;
  depositExtraId?: string | null; // memo to include when sending the deposit
  destinationAddress: string;
  destinationExtraId?: string | null; // memo for the user's destination
  status: TransactionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTransactionInput {
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

export interface CreateTransactionResult {
  providerTxId: string;
  depositAddress: string;
  depositExtraId: string | null;
  toAmount: number;
}

export interface StatusResult {
  status: TransactionStatus;
  amountFrom: number;
  amountTo: number;
}

/**
 * Common interface every swap provider implements. The server depends only on
 * this shape, so adding a second provider (SimpleSwap, StealthEX, …) later is
 * a matter of writing one more class — no route changes needed.
 */
export interface SwapProvider {
  readonly name: string;
  isReady(): boolean;
  getCoinList(): Promise<CoinInfo[]>;
  getQuote(
    fromCoin: string,
    fromNetwork: string,
    toCoin: string,
    toNetwork: string,
    amount: number,
  ): Promise<SwapQuote>;
  createTransaction(
    input: CreateTransactionInput,
  ): Promise<CreateTransactionResult>;
  getStatus(providerTxId: string): Promise<StatusResult>;
}

export interface ApiError {
  error: string;
  code?: string;
}
