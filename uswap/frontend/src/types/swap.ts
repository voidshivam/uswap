export type TransactionStatus =
  | "Waiting"
  | "Confirming"
  | "Exchanging"
  | "Sending"
  | "Finished"
  | "Failed"
  | "Refunded"
  | "Expired";

export interface CoinInfo {
  symbol: string;
  name: string;
  network: string;
  logoUrl: string;
  hasExtraId?: boolean; // memo/tag required for this chain
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
  clientTxId: string | null;
  provider: string;
  providerTxId: string;
  fromCoin: string;
  toCoin: string;
  fromNetwork: string;
  toNetwork: string;
  fromAmount: number;
  toAmount: number;
  depositAddress: string;
  depositExtraId?: string | null;
  destinationAddress: string;
  destinationExtraId?: string | null;
  status: TransactionStatus;
  createdAt: number;
  updatedAt: number;
}

export const STATUS_LABELS: Record<TransactionStatus, string> = {
  Waiting: "Waiting for deposit",
  Confirming: "Confirming deposit",
  Exchanging: "Exchanging",
  Sending: "Sending to you",
  Finished: "Completed",
  Failed: "Failed",
  Refunded: "Refunded",
  Expired: "Expired",
};

export const TERMINAL_STATUSES: TransactionStatus[] = [
  "Finished",
  "Failed",
  "Refunded",
  "Expired",
];
