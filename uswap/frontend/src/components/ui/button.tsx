import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 outline-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-indigo text-white shadow-glow hover:bg-indigo-700 hover:shadow-lift",
        mint: "bg-mint text-white shadow-glow-mint hover:bg-mint-700",
        soft: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
        outline:
          "border border-line bg-white text-ink hover:border-indigo/40 hover:bg-indigo-50/50",
        ghost: "text-slate hover:bg-line/60 hover:text-ink",
        link: "text-indigo underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-lg px-3.5 text-[13px]",
        lg: "h-13 rounded-2xl px-7 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}

export { buttonVariants };
