import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BearEmpty, BearLoader } from "@/components/Bear";
import {
  useGetTransaction,
  useRefreshTransactionStatus,
} from "@/hooks/use-swap";
import { formatAmount, truncateAddress } from "@/lib/api";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, TERMINAL_STATUSES } from "@/types/swap";
import type { TransactionStatus } from "@/types/swap";

const STATUS_STEPS: TransactionStatus[] = [
  "Waiting",
  "Confirming",
  "Exchanging",
  "Sending",
  "Finished",
];

function StepTimeline({ currentStatus }: { currentStatus: TransactionStatus }) {
  const currentIdx = STATUS_STEPS.indexOf(currentStatus);
  const isFailed = ["Failed", "Expired", "Refunded"].includes(currentStatus);

  return (
    <div className="flex items-center w-full">
      {STATUS_STEPS.map((step, i) => {
        const isComplete = !isFailed && currentIdx > i;
        const isActive = !isFailed && currentIdx === i;
        const isError = isFailed && currentIdx === i;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition-all border-2",
                  isComplete && "bg-indigo border-indigo",
                  isActive && "bg-mint border-mint animate-breathe",
                  isError && "bg-danger border-danger",
                  !isComplete &&
                    !isActive &&
                    !isError &&
                    "bg-white border-line",
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                ) : isError ? (
                  <XCircle className="w-4 h-4 text-white" />
                ) : (
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      isActive ? "bg-white" : "bg-mist/40",
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold whitespace-nowrap",
                  isActive
                    ? "text-mint-700"
                    : isComplete
                      ? "text-slate"
                      : "text-mist/60",
                )}
              >
                {step === "Waiting"
                  ? "Send"
                  : step === "Finished"
                    ? "Done"
                    : step}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-1.5 rounded-full transition-all",
                  isComplete ? "bg-indigo" : "bg-line",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      }}
      className={cn(
        "ml-1 p-1.5 rounded-lg transition-colors",
        copied
          ? "text-mint-700 bg-mint-50"
          : "text-mist hover:text-indigo hover:bg-indigo-50",
      )}
      aria-label="Copy"
    >
      {copied ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function DetailRow({
  label,
  value,
  copy,
  danger,
}: {
  label: string;
  value: string;
  copy?: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={cn(
          "text-xs",
          danger ? "text-danger font-semibold" : "text-slate",
        )}
      >
        {label}
      </span>
      <div className="flex items-center min-w-0">
        <span className="font-mono text-xs text-ink truncate max-w-[150px]">
          {value}
        </span>
        {copy && <CopyButton value={copy} />}
      </div>
    </div>
  );
}

export function TrackPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { id?: string };
  const [inputId, setInputId] = useState(search.id ?? "");
  const [trackedId, setTrackedId] = useState(search.id ?? "");

  const { data: tx, isLoading, isError } = useGetTransaction(trackedId || null);
  const refreshMutation = useRefreshTransactionStatus();

  const handleTrack = () => {
    const trimmed = inputId.trim();
    if (!trimmed) return;
    setTrackedId(trimmed);
    navigate({ to: "/track", search: { id: trimmed } });
  };

  const handleRefresh = async () => {
    if (!trackedId) return;
    try {
      await refreshMutation.mutateAsync(trackedId);
      toast.success("Status refreshed");
    } catch {
      toast.error("Could not refresh status");
    }
  };

  const isTerminal = tx && TERMINAL_STATUSES.includes(tx.status);
  const statusTone =
    tx?.status === "Finished"
      ? "mint"
      : tx && ["Failed", "Expired"].includes(tx.status)
        ? "danger"
        : tx?.status === "Refunded"
          ? "neutral"
          : "indigo";

  return (
    <div className="flex-1 bg-mesh flex flex-col items-center px-5 py-10 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md space-y-4"
      >
        <div className="text-center mb-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Track your swap
          </h1>
          <p className="text-sm text-mist mt-1">
            Enter a transaction ID to see live status.
          </p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl border border-line shadow-soft p-3">
          <div className="flex gap-2">
            <Input
              placeholder="Transaction ID…"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTrack()}
              className="font-mono text-sm flex-1 border-transparent bg-canvas"
            />
            <Button
              type="button"
              onClick={handleTrack}
              disabled={!inputId.trim()}
              size="icon"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isLoading && trackedId && (
          <div className="bg-white rounded-2xl border border-line shadow-soft">
            <BearLoader label="Looking up your swap…" />
          </div>
        )}

        {isError && trackedId && (
          <div className="bg-white rounded-2xl border border-line shadow-soft">
            <BearEmpty
              title="We couldn't find that swap"
              hint="Double-check the transaction ID and try again."
            />
          </div>
        )}

        {!trackedId && (
          <div className="bg-white rounded-2xl border border-line shadow-soft">
            <BearEmpty
              title="Nothing to track yet"
              hint="Paste a transaction ID above, or start a new swap."
            >
              <Button
                variant="soft"
                size="sm"
                onClick={() => navigate({ to: "/swap" })}
              >
                Start a swap
              </Button>
            </BearEmpty>
          </div>
        )}

        {tx && (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-line shadow-lift overflow-hidden"
          >
            {/* Status header */}
            <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-line">
              <div>
                <div className="font-bold text-ink">
                  {STATUS_LABELS[tx.status]}
                </div>
                <div className="text-xs text-mist font-mono mt-0.5">
                  {truncateAddress(tx.id, 8)}
                </div>
              </div>
              <Badge variant={statusTone}>{tx.status}</Badge>
            </div>

            {/* Amounts */}
            <div className="px-5 py-5 flex items-center justify-between gap-3 bg-canvas">
              <div className="text-center flex-1">
                <div className="font-mono font-bold text-lg text-ink">
                  {formatAmount(tx.fromAmount)}
                </div>
                <div className="text-xs text-mist mt-0.5 font-semibold">
                  {tx.fromCoin}
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                <ArrowRight className="w-4 h-4 text-indigo" />
              </div>
              <div className="text-center flex-1">
                <div className="font-mono font-bold text-lg text-mint-700">
                  {formatAmount(tx.toAmount)}
                </div>
                <div className="text-xs text-mist mt-0.5 font-semibold">
                  {tx.toCoin}
                </div>
              </div>
            </div>

            {/* Timeline */}
            {(!isTerminal || tx.status === "Finished") && (
              <div className="px-5 py-5 border-b border-line">
                <StepTimeline currentStatus={tx.status} />
              </div>
            )}

            {/* Deposit instruction */}
            {tx.status === "Waiting" && tx.depositAddress && (
              <div className="m-4 bg-indigo-50/70 rounded-2xl p-4 space-y-3">
                <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                  Action required
                </div>
                <p className="text-xs text-slate leading-relaxed">
                  Send exactly{" "}
                  <span className="font-mono font-bold text-ink">
                    {formatAmount(tx.fromAmount)} {tx.fromCoin}
                  </span>{" "}
                  to this address:
                </p>
                <div className="flex items-center gap-1 bg-white border border-line rounded-xl px-3 py-2">
                  <span className="font-mono text-xs text-ink break-all flex-1">
                    {tx.depositAddress}
                  </span>
                  <CopyButton value={tx.depositAddress} />
                </div>
                {tx.depositExtraId && (
                  <>
                    <p className="text-xs text-danger font-semibold leading-relaxed">
                      ⚠ This chain requires a memo / tag. Include it with your
                      deposit or the funds will be lost:
                    </p>
                    <div className="flex items-center gap-1 bg-danger/8 border border-danger/20 rounded-xl px-3 py-2">
                      <span className="font-mono text-xs text-ink break-all flex-1">
                        {tx.depositExtraId}
                      </span>
                      <CopyButton value={tx.depositExtraId} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Details */}
            <div className="px-5 py-4 space-y-2.5">
              <div className="text-[11px] font-bold text-mist uppercase tracking-wider">
                Details
              </div>
              <DetailRow
                label="Deposit address"
                value={truncateAddress(tx.depositAddress)}
                copy={tx.depositAddress}
              />
              {tx.depositExtraId && (
                <DetailRow
                  label="Deposit memo (required)"
                  value={tx.depositExtraId}
                  copy={tx.depositExtraId}
                  danger
                />
              )}
              <DetailRow
                label="Receiving address"
                value={truncateAddress(tx.destinationAddress)}
                copy={tx.destinationAddress}
              />
              {tx.destinationExtraId && (
                <DetailRow
                  label="Receiving memo"
                  value={tx.destinationExtraId}
                  copy={tx.destinationExtraId}
                />
              )}
              <DetailRow
                label="Provider"
                value={`${tx.provider} · ${truncateAddress(tx.providerTxId, 5)}`}
              />
            </div>

            {/* Refresh */}
            {!isTerminal && (
              <div className="px-5 pb-5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshMutation.isPending}
                  className="w-full"
                >
                  <RefreshCw
                    className={cn(
                      "w-3.5 h-3.5",
                      refreshMutation.isPending && "animate-spin",
                    )}
                  />
                  {refreshMutation.isPending ? "Refreshing…" : "Refresh now"}
                </Button>
                <p className="text-[10px] text-center text-mist mt-2">
                  Auto-refreshes every 10 seconds
                </p>
              </div>
            )}
          </motion.div>
        )}

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => navigate({ to: "/swap" })}
            className="text-xs text-mist hover:text-indigo transition-colors font-medium"
          >
            ← Start a new swap
          </button>
        </div>
      </motion.div>
    </div>
  );
}
