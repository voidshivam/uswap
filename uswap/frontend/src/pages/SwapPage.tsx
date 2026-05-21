import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronDown,
  Loader2,
  Search,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BearEmpty } from "@/components/Bear";
import { useDebounce } from "@/hooks/use-debounce";
import {
  useCreateTransaction,
  useGetQuote,
  useGetSupportedCoins,
} from "@/hooks/use-swap";
import { formatAmount, truncateAddress } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSwapStore } from "@/store/swap-store";
import type { CoinInfo } from "@/types/swap";

// ─── Coin picker modal ───────────────────────────────────────────────────────
function CoinModal({
  open,
  onClose,
  onSelect,
  coins,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (coin: CoinInfo) => void;
  coins: CoinInfo[];
  title: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return coins.slice(0, 80);
    return coins
      .filter(
        (c) =>
          c.symbol.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q),
      )
      .slice(0, 80);
  }, [coins, search]);

  const symbolCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of coins) map[c.symbol] = (map[c.symbol] ?? 0) + 1;
    return map;
  }, [coins]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mist" />
          <Input
            placeholder="Search by name or symbol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="max-h-80 overflow-y-auto scroll-soft -mr-1 pr-1 space-y-0.5">
          {filtered.length === 0 ? (
            <BearEmpty title="No coins found" hint="Try a different search." />
          ) : (
            filtered.map((coin) => (
              <button
                key={`${coin.symbol}-${coin.network}`}
                type="button"
                onClick={() => {
                  onSelect(coin);
                  onClose();
                  setSearch("");
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors text-left"
              >
                <img
                  src={coin.logoUrl || "/assets/images/placeholder.svg"}
                  alt=""
                  loading="lazy"
                  className="w-8 h-8 rounded-full bg-canvas flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/assets/images/placeholder.svg";
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-ink text-sm">
                    {coin.symbol}
                  </div>
                  <div className="text-xs text-mist truncate">{coin.name}</div>
                </div>
                {(symbolCount[coin.symbol] ?? 1) > 1 && (
                  <Badge variant="outline" className="font-mono shrink-0">
                    {coin.network}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Coin selector pill ──────────────────────────────────────────────────────
function CoinSelector({
  coin,
  onClick,
  label,
  showNetwork,
}: {
  coin: CoinInfo | null;
  onClick: () => void;
  label: string;
  showNetwork: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 pl-2.5 pr-3 py-2 rounded-xl border transition-all flex-shrink-0 active:scale-[0.98]",
        coin
          ? "bg-white border-line hover:border-indigo/40 shadow-soft"
          : "bg-indigo text-white border-indigo shadow-glow hover:bg-indigo-700",
      )}
    >
      {coin ? (
        <>
          <img
            src={coin.logoUrl || "/assets/images/placeholder.svg"}
            alt=""
            className="w-7 h-7 rounded-full bg-canvas flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "/assets/images/placeholder.svg";
            }}
          />
          <div className="text-left min-w-0">
            <div className="font-bold text-sm text-ink leading-tight">
              {coin.symbol}
            </div>
            {showNetwork && (
              <div className="text-[11px] text-mist leading-tight uppercase">
                {coin.network}
              </div>
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-mist" />
        </>
      ) : (
        <span className="text-sm font-semibold px-1 flex items-center gap-1.5">
          {label}
          <ChevronDown className="w-4 h-4" />
        </span>
      )}
    </button>
  );
}

function InfoRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate">{label}</span>
      <span
        className={cn(
          "font-mono text-[13px] font-medium",
          accent ? "text-mint-700" : "text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Swap page ───────────────────────────────────────────────────────────────
export function SwapPage() {
  const navigate = useNavigate();
  const {
    fromCoin,
    toCoin,
    fromAmount,
    destinationAddress,
    destinationExtraId,
    clientTxId,
    setFromCoin,
    setToCoin,
    setFromAmount,
    setDestinationAddress,
    setDestinationExtraId,
    setCurrentTransactionId,
    addRecentTransaction,
    rotateClientTxId,
    swapCoins,
    setSelectedQuote,
  } = useSwapStore();

  const [fromModalOpen, setFromModalOpen] = useState(false);
  const [toModalOpen, setToModalOpen] = useState(false);
  const [addressTouched, setAddressTouched] = useState(false);
  const [memoAcknowledged, setMemoAcknowledged] = useState(false);

  const { data: coins = [], isLoading: coinsLoading } = useGetSupportedCoins();

  const symbolNetworkCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of coins) map[c.symbol] = (map[c.symbol] ?? 0) + 1;
    return map;
  }, [coins]);

  const fromShowNetwork = fromCoin
    ? (symbolNetworkCount[fromCoin.symbol] ?? 1) > 1
    : false;
  const toShowNetwork = toCoin
    ? (symbolNetworkCount[toCoin.symbol] ?? 1) > 1
    : false;

  // Debounce the typed amount so we quote on a pause, not every keystroke.
  const debouncedAmount = useDebounce(fromAmount, 450);
  const parsedAmount = debouncedAmount
    ? Number.parseFloat(debouncedAmount)
    : undefined;
  const typedAmount = fromAmount ? Number.parseFloat(fromAmount) : undefined;

  const {
    data: quote,
    isFetching: quoteFetching,
    isError: quoteError,
  } = useGetQuote(
    fromCoin ?? undefined,
    toCoin ?? undefined,
    parsedAmount && parsedAmount > 0 ? parsedAmount : undefined,
  );

  const createTx = useCreateTransaction();

  useEffect(() => {
    setSelectedQuote(quote ?? null);
  }, [quote, setSelectedQuote]);

  // Memos belong to one chain — clear when the destination coin changes.
  useEffect(() => {
    setDestinationExtraId("");
    setMemoAcknowledged(false);
  }, [toCoin?.symbol, toCoin?.network, setDestinationExtraId]);

  const isAddressValid = destinationAddress.trim().length >= 12;
  const isAddressInvalid =
    addressTouched && destinationAddress.trim().length > 0 && !isAddressValid;

  const destinationNeedsMemo = !!toCoin?.hasExtraId;
  const hasMemo = destinationExtraId.trim().length > 0;

  const belowMin =
    quote &&
    parsedAmount !== undefined &&
    quote.minAmount > 0 &&
    parsedAmount < quote.minAmount;
  const aboveMax =
    quote &&
    parsedAmount !== undefined &&
    quote.maxAmount > 0 &&
    parsedAmount > quote.maxAmount;

  const canSwap =
    !!fromCoin &&
    !!toCoin &&
    !!parsedAmount &&
    parsedAmount > 0 &&
    isAddressValid &&
    !!quote &&
    !belowMin &&
    !aboveMax &&
    !createTx.isPending &&
    (!destinationNeedsMemo || hasMemo || memoAcknowledged);

  const handleSwap = useCallback(async () => {
    if (!canSwap || !fromCoin || !toCoin || !parsedAmount) return;
    try {
      const tx = await createTx.mutateAsync({
        clientTxId, // idempotency key — reused on retry, never double-creates
        fromCoin: fromCoin.symbol,
        fromNetwork: fromCoin.network,
        toCoin: toCoin.symbol,
        toNetwork: toCoin.network,
        fromAmount: parsedAmount,
        destinationAddress: destinationAddress.trim(),
        destinationExtraId:
          destinationExtraId.trim().length > 0
            ? destinationExtraId.trim()
            : null,
        refundAddress: null,
        refundExtraId: null,
      });

      if (!tx.depositAddress || tx.depositAddress.trim().length === 0) {
        toast.error("Provider returned an empty deposit address. Try again.");
        return;
      }

      setCurrentTransactionId(tx.id);
      addRecentTransaction(tx.id);
      rotateClientTxId(); // fresh key for the next swap
      toast.success("Swap created — send your deposit to begin.");
      navigate({ to: "/track", search: { id: tx.id } });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create transaction",
      );
    }
  }, [
    canSwap,
    fromCoin,
    toCoin,
    parsedAmount,
    destinationAddress,
    destinationExtraId,
    clientTxId,
    createTx,
    setCurrentTransactionId,
    addRecentTransaction,
    rotateClientTxId,
    navigate,
  ]);

  const estimatedReceive = quote ? quote.toAmount : 0;
  const showRateBox = !!fromCoin && !!toCoin && !!typedAmount && typedAmount > 0;

  return (
    <div className="flex-1 bg-mesh flex flex-col items-center px-5 py-10 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[460px]"
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Instant Swap
          </h1>
          <p className="text-sm text-mist mt-1">
            No account · Non-custodial · Powered by ChangeNOW
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-line shadow-lift overflow-hidden">
          <div className="p-5 space-y-2">
            {/* FROM */}
            <div className="bg-canvas rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-mist uppercase tracking-wider">
                  You send
                </span>
              </div>
              <div className="flex items-center gap-3">
                {coinsLoading ? (
                  <Skeleton className="h-11 w-28 rounded-xl" />
                ) : (
                  <CoinSelector
                    coin={fromCoin}
                    onClick={() => setFromModalOpen(true)}
                    label="Select"
                    showNetwork={fromShowNetwork}
                  />
                )}
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="flex-1 bg-transparent text-2xl font-bold outline-none min-w-0 text-right text-ink placeholder:text-mist/40"
                />
              </div>
            </div>

            {/* Switch */}
            <div className="flex justify-center -my-2.5 relative z-10">
              <button
                type="button"
                onClick={swapCoins}
                className="w-10 h-10 rounded-xl bg-white border border-line shadow-soft flex items-center justify-center hover:border-indigo/40 hover:bg-indigo-50 transition-all group active:scale-90"
                aria-label="Swap direction"
              >
                <ArrowDown className="w-4 h-4 text-indigo transition-transform duration-300 group-hover:rotate-180" />
              </button>
            </div>

            {/* TO */}
            <div className="bg-canvas rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-mist uppercase tracking-wider">
                  You receive
                </span>
                {quoteFetching && showRateBox && (
                  <span className="text-[11px] text-indigo font-medium flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Updating rate
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {coinsLoading ? (
                  <Skeleton className="h-11 w-28 rounded-xl" />
                ) : (
                  <CoinSelector
                    coin={toCoin}
                    onClick={() => setToModalOpen(true)}
                    label="Select"
                    showNetwork={toShowNetwork}
                  />
                )}
                <div className="flex-1 text-right min-w-0">
                  <div className="text-2xl font-bold text-ink truncate">
                    {quoteFetching && showRateBox ? (
                      <span className="text-mist/50">…</span>
                    ) : estimatedReceive > 0 ? (
                      formatAmount(estimatedReceive)
                    ) : (
                      <span className="text-mist/40">0.00</span>
                    )}
                  </div>
                  {quote && estimatedReceive > 0 && (
                    <div className="text-[11px] text-mist mt-0.5">
                      All fees included
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rate / errors */}
            <AnimatePresence mode="wait">
              {quote && !quoteFetching && showRateBox && (
                <motion.div
                  key="rate"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-indigo-50/70 rounded-2xl p-3.5 space-y-1.5 mt-1"
                >
                  <InfoRow
                    label="Rate"
                    value={`1 ${fromCoin?.symbol} ≈ ${formatAmount(quote.rate)} ${toCoin?.symbol}`}
                  />
                  <InfoRow
                    label="Estimated time"
                    value={quote.estimatedDuration}
                    accent
                  />
                  {(belowMin || aboveMax) && (
                    <div className="flex items-center gap-1.5 text-xs text-danger pt-1.5 mt-0.5 border-t border-danger/15">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      {belowMin
                        ? `Minimum is ${formatAmount(quote.minAmount)} ${fromCoin?.symbol}`
                        : `Maximum is ${formatAmount(quote.maxAmount)} ${fromCoin?.symbol}`}
                    </div>
                  )}
                </motion.div>
              )}
              {quoteError && showRateBox && !quoteFetching && (
                <motion.div
                  key="err"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-sm text-danger bg-danger/8 rounded-2xl px-4 py-3 mt-1"
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  This pair or amount isn't available right now.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recipient address */}
            <div className="space-y-1.5 pt-1">
              <label
                className="text-xs font-bold text-mist uppercase tracking-wider"
                htmlFor="dest-addr"
              >
                Recipient address
              </label>
              <div className="relative">
                <Input
                  id="dest-addr"
                  placeholder={
                    toCoin
                      ? `Your ${toCoin.symbol} wallet address`
                      : "Select a coin to receive first"
                  }
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  onBlur={() => setAddressTouched(true)}
                  className={cn(
                    "font-mono text-sm pr-9",
                    isAddressValid && destinationAddress.trim().length > 0
                      ? "border-mint focus-visible:border-mint"
                      : isAddressInvalid &&
                          "border-danger focus-visible:border-danger",
                  )}
                  disabled={!toCoin}
                />
                {isAddressValid && destinationAddress.trim().length > 0 && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mint-700" />
                )}
              </div>
              <AnimatePresence>
                {isAddressInvalid && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-danger flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    That doesn't look like a valid wallet address.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Destination memo / tag */}
            {destinationNeedsMemo && (
              <div className="space-y-1.5">
                <label
                  className="text-xs font-bold text-mist uppercase tracking-wider flex items-center gap-1.5"
                  htmlFor="dest-memo"
                >
                  Destination tag / memo
                  <span className="text-[10px] text-danger normal-case font-semibold">
                    {toCoin?.symbol} may require this
                  </span>
                </label>
                <Input
                  id="dest-memo"
                  placeholder={`Memo / tag for your ${toCoin?.symbol} address`}
                  value={destinationExtraId}
                  onChange={(e) => setDestinationExtraId(e.target.value)}
                  className="font-mono text-sm"
                />
                {!hasMemo && (
                  <label className="flex items-start gap-2 text-[11px] text-slate mt-1 cursor-pointer leading-snug">
                    <input
                      type="checkbox"
                      checked={memoAcknowledged}
                      onChange={(e) => setMemoAcknowledged(e.target.checked)}
                      className="accent-indigo mt-0.5"
                    />
                    <span>
                      I'm sending to a personal wallet that doesn't need a memo.
                      I understand sending to an exchange without one can lose
                      funds.
                    </span>
                  </label>
                )}
              </div>
            )}

            <Button
              type="button"
              onClick={handleSwap}
              disabled={!canSwap}
              size="lg"
              className="w-full mt-2"
            >
              {createTx.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating swap…
                </>
              ) : fromCoin && toCoin ? (
                `Swap ${fromCoin.symbol} → ${toCoin.symbol}`
              ) : (
                "Select coins to swap"
              )}
            </Button>
          </div>

          {/* Summary */}
          {quote && isAddressValid && !belowMin && !aboveMax && showRateBox && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-canvas border-t border-line px-5 py-4 space-y-2"
            >
              <div className="text-[11px] font-bold text-mist uppercase tracking-wider">
                Summary
              </div>
              <InfoRow
                label="Recipient"
                value={truncateAddress(destinationAddress)}
              />
              {destinationExtraId.trim().length > 0 && (
                <InfoRow label="Memo / tag" value={destinationExtraId.trim()} />
              )}
              <InfoRow
                label="You receive"
                value={`${formatAmount(estimatedReceive)} ${toCoin?.symbol}`}
                accent
              />
            </motion.div>
          )}
        </div>

        <p className="text-center text-xs text-mist mt-4">
          Rates refresh automatically · You confirm before any funds move.
        </p>
      </motion.div>

      <CoinModal
        open={fromModalOpen}
        onClose={() => setFromModalOpen(false)}
        onSelect={setFromCoin}
        coins={coins}
        title="Send which coin?"
      />
      <CoinModal
        open={toModalOpen}
        onClose={() => setToModalOpen(false)}
        onSelect={setToCoin}
        coins={coins}
        title="Receive which coin?"
      />
    </div>
  );
}
