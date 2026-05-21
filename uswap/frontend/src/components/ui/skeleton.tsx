import type * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("bg-line/80 animate-pulse rounded-lg", className)}
      {...props}
    />
  );
}
