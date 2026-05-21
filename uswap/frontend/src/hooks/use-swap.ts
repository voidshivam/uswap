import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type CreateTransactionInput } from "@/lib/api";
import { TERMINAL_STATUSES } from "@/types/swap";
import type { CoinInfo, SwapQuote, Transaction } from "@/types/swap";

export const swapKeys = {
  coins: ["coins"] as const,
  quote: (
    from: string,
    fromNet: string,
    to: string,
    toNet: string,
    amount: number,
  ) => ["quote", from, fromNet, to, toNet, amount] as const,
  transaction: (id: string) => ["transaction", id] as const,
};

export function useGetSupportedCoins() {
  return useQuery<CoinInfo[]>({
    queryKey: swapKeys.coins,
    queryFn: () => api.getCoins(),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useGetQuote(
  from: CoinInfo | undefined,
  to: CoinInfo | undefined,
  fromAmount: number | undefined,
) {
  const enabled =
    !!from &&
    !!to &&
    !!from.network &&
    !!to.network &&
    !!fromAmount &&
    fromAmount > 0;
  return useQuery<SwapQuote>({
    queryKey: swapKeys.quote(
      from?.symbol ?? "",
      from?.network ?? "",
      to?.symbol ?? "",
      to?.network ?? "",
      fromAmount ?? 0,
    ),
    queryFn: () =>
      api.getQuote(
        from!.symbol,
        from!.network,
        to!.symbol,
        to!.network,
        fromAmount!,
      ),
    enabled,
    staleTime: 25_000,
    // Quotes refresh themselves so the displayed rate stays live.
    refetchInterval: enabled ? 30_000 : false,
    retry: 1,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation<Transaction, Error, CreateTransactionInput>({
    mutationFn: (params) => api.createTransaction(params),
    onSuccess: (tx) => {
      qc.setQueryData(swapKeys.transaction(tx.id), tx);
    },
  });
}

export function useGetTransaction(txId: string | null) {
  return useQuery<Transaction>({
    queryKey: swapKeys.transaction(txId ?? ""),
    queryFn: () => api.getTransaction(txId!),
    enabled: !!txId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      return 10_000;
    },
    staleTime: 5_000,
    retry: 1,
  });
}

export function useRefreshTransactionStatus() {
  const qc = useQueryClient();
  return useMutation<Transaction, Error, string>({
    mutationFn: (id) => api.refreshTransaction(id),
    onSuccess: (tx) => {
      qc.setQueryData(swapKeys.transaction(tx.id), tx);
    },
  });
}
