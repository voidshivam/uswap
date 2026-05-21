// Input validation — same rules as the audited Motoko backend.

const SYMBOL_RE = /^[a-zA-Z0-9]{1,12}$/;
const NETWORK_RE = /^[a-zA-Z0-9]{2,16}$/;
// extraId is a memo/tag for chains that need one. XRP destination tags are
// integers <=2^32, XLM/EOS/ATOM memos are short alphanumeric strings.
const EXTRA_ID_RE = /^[a-zA-Z0-9._-]{1,120}$/;
// UUID v1-v8, used as the client idempotency key.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSymbol(s: unknown): s is string {
  return typeof s === "string" && SYMBOL_RE.test(s);
}

export function isValidNetwork(s: unknown): s is string {
  return typeof s === "string" && NETWORK_RE.test(s);
}

export function isValidExtraId(s: unknown): s is string {
  return typeof s === "string" && EXTRA_ID_RE.test(s);
}

export function isValidClientTxId(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}

export function isValidAddress(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const trimmed = s.replace(/\s/g, "");
  // Loose lower bound — ChangeNOW does the per-network format check server-side.
  return trimmed.length >= 12 && trimmed.length <= 200;
}

export function isPositiveNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}
