import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold w-fit whitespace-nowrap shrink-0",
  {
    variants: {
      variant: {
        indigo: "bg-indigo-50 text-indigo-700",
        mint: "bg-mint-50 text-mint-700",
        neutral: "bg-line/70 text-slate",
        danger: "bg-danger/10 text-danger",
        outline: "border border-line text-slate",
      },
    },
    defaultVariants: { variant: "indigo" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
