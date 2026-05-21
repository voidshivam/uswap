// USwap mascot — a minimal, friendly Japanese-style bear.
//
// Pure inline SVG: no image requests, scales crisply, ~2KB. Three moods cover
// the only places the mascot appears (per brand rules): landing, loading,
// empty states. Animation is CSS-only and lightweight.

type BearMood = "happy" | "sleeping" | "peeking";

interface BearProps {
  mood?: BearMood;
  size?: number;
  className?: string;
  /** Adds a gentle idle float — used on the landing hero. */
  float?: boolean;
}

export function Bear({
  mood = "happy",
  size = 120,
  className = "",
  float = false,
}: BearProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="USwap bear mascot"
      className={`${float ? "animate-float" : ""} ${className}`}
    >
      {/* soft shadow */}
      <ellipse cx="60" cy="108" rx="30" ry="6" fill="#1A1D2E" opacity="0.06" />

      {/* ears */}
      <circle cx="34" cy="34" r="15" fill="#E0E3FF" />
      <circle cx="86" cy="34" r="15" fill="#E0E3FF" />
      <circle cx="34" cy="34" r="7.5" fill="#C3C9FF" />
      <circle cx="86" cy="34" r="7.5" fill="#C3C9FF" />

      {/* head */}
      <circle cx="60" cy="58" r="38" fill="#EEF0FF" />
      <circle cx="60" cy="58" r="38" stroke="#C3C9FF" strokeWidth="2" />

      {/* snout */}
      <ellipse cx="60" cy="70" rx="17" ry="13" fill="#FFFFFF" />

      {/* cheeks */}
      <circle cx="36" cy="66" r="6.5" fill="#FFD3DE" opacity="0.9" />
      <circle cx="84" cy="66" r="6.5" fill="#FFD3DE" opacity="0.9" />

      {/* nose */}
      <ellipse cx="60" cy="63" rx="5" ry="3.6" fill="#5B6EFF" />

      {mood === "sleeping" ? (
        <>
          {/* closed, content eyes */}
          <path
            d="M40 52 q6 6 12 0"
            stroke="#1A1D2E"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M68 52 q6 6 12 0"
            stroke="#1A1D2E"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          {/* drifting Z's */}
          <text
            x="92"
            y="30"
            fontSize="13"
            fontWeight="700"
            fill="#5B6EFF"
            opacity="0.7"
          >
            z
          </text>
          <text
            x="100"
            y="18"
            fontSize="9"
            fontWeight="700"
            fill="#5B6EFF"
            opacity="0.5"
          >
            z
          </text>
        </>
      ) : mood === "peeking" ? (
        <>
          {/* curious, looking-up eyes */}
          <circle cx="46" cy="52" r="4.5" fill="#1A1D2E" />
          <circle cx="74" cy="52" r="4.5" fill="#1A1D2E" />
          <circle cx="47.6" cy="50.4" r="1.6" fill="#FFFFFF" />
          <circle cx="75.6" cy="50.4" r="1.6" fill="#FFFFFF" />
          {/* tiny ":o" surprised mouth */}
          <circle
            cx="60"
            cy="74"
            r="3"
            stroke="#1A1D2E"
            strokeWidth="2.4"
            fill="none"
          />
        </>
      ) : (
        <>
          {/* happy, bright eyes */}
          <circle cx="46" cy="53" r="4.8" fill="#1A1D2E" />
          <circle cx="74" cy="53" r="4.8" fill="#1A1D2E" />
          <circle cx="47.8" cy="51.2" r="1.8" fill="#FFFFFF" />
          <circle cx="75.8" cy="51.2" r="1.8" fill="#FFFFFF" />
          {/* smile */}
          <path
            d="M53 73 q7 7 14 0"
            stroke="#1A1D2E"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
    </svg>
  );
}

/**
 * Loading state: a sleeping bear above a small branded spinner.
 * Used by route-level Suspense fallbacks and in-page pending states.
 */
export function BearLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Bear mood="sleeping" size={96} className="animate-breathe" />
      <div className="flex items-center gap-2.5">
        <span className="h-4 w-4 rounded-full border-2 border-indigo border-t-transparent animate-spin-slow" />
        <span className="text-sm font-medium text-mist">
          {label ?? "Just a moment…"}
        </span>
      </div>
    </div>
  );
}

/**
 * Empty state: a peeking bear with a headline + optional hint.
 */
export function BearEmpty({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Bear mood="peeking" size={88} />
      <div>
        <p className="font-semibold text-ink">{title}</p>
        {hint && <p className="mt-1 text-sm text-mist">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
