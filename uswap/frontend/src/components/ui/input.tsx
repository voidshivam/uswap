import type * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-line bg-white px-3.5 py-2 text-sm text-ink shadow-soft outline-none transition-all duration-200 placeholder:text-mist/70 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-canvas focus-visible:border-indigo/60 focus-visible:ring-2 focus-visible:ring-indigo/15",
        className,
      )}
      {...props}
    />
  );
}
