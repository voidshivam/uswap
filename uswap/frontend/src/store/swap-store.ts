import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CoinInfo, SwapQuote } from "@/types/swap";

interface SwapStore {
  fromCoin: CoinInfo | null;
  toCoin: CoinInfo | null;
  fromAmount: string;
  destinationAddress: string;
  destinationExtraId: string;
  currentTransactionId: string | null;
  selectedQuote: SwapQuote | null;
  recentTransactionIds: string[];

  /**
   * Idempotency key for the swap currently being composed. Generated once and
   * reused for every retry of the same swap, so a flaky network or double-tap
   * can never create two transactions. Rotated after a successful create.
   */
  clientTxId: string;

  setFromCoin: (coin: CoinInfo | null) => void;
  setToCoin: (coin: CoinInfo | null) => void;
  setFromAmount: (amount: string) => void;
  setDestinationAddress: (address: string) => void;
  setDestinationExtraId: (extra: string) => void;
  setCurrentTransactionId: (id: string | null) => void;
  setSelectedQuote: (quote: SwapQuote | null) => void;
  addRecentTransaction: (id: string) => void;
  rotateClientTxId: () => void;
  swapCoins: () => void;
  reset: () => void;
}

function newUuid(): string {
  // crypto.randomUUID is available in every browser Vite targets.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Defensive fallback (very old browsers / non-secure contexts).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const baseState = {
  fromCoin: null,
  toCoin: null,
  fromAmount: "",
  destinationAddress: "",
  destinationExtraId: "",
  currentTransactionId: null,
  selectedQuote: null,
  recentTransactionIds: [] as string[],
};

export const useSwapStore = create<SwapStore>()(
  persist(
    (set) => ({
      ...baseState,
      clientTxId: newUuid(),

      setFromCoin: (coin) => set({ fromCoin: coin }),
      setToCoin: (coin) => set({ toCoin: coin }),
      setFromAmount: (amount) => set({ fromAmount: amount }),
      setDestinationAddress: (address) =>
        set({ destinationAddress: address }),
      setDestinationExtraId: (extra) => set({ destinationExtraId: extra }),
      setCurrentTransactionId: (id) => set({ currentTransactionId: id }),
      setSelectedQuote: (quote) => set({ selectedQuote: quote }),
      addRecentTransaction: (id) =>
        set((state) => ({
          recentTransactionIds: [
            id,
            ...state.recentTransactionIds.filter((x) => x !== id),
          ].slice(0, 10),
        })),
      rotateClientTxId: () => set({ clientTxId: newUuid() }),
      swapCoins: () =>
        set((state) => ({
          fromCoin: state.toCoin,
          toCoin: state.fromCoin,
          destinationExtraId: "",
          selectedQuote: null,
        })),
      reset: () => set({ ...baseState, clientTxId: newUuid() }),
    }),
    {
      name: "uswap-store",
      // Only the recent-tx list is persisted; the in-progress form is not.
      partialize: (s) => ({ recentTransactionIds: s.recentTransactionIds }),
    },
  ),
);
