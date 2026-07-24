import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-badge font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary-pale text-positive-deep",
        secondary: "border-transparent bg-surface-soft text-foreground",
        destructive: "border-transparent bg-[#320707] text-white",
        outline: "border-foreground text-foreground bg-card",
        new: "border-transparent bg-primary-pale text-positive-deep uppercase tracking-[0.32px] text-[10px] font-bold px-1.5 py-0.5",
        positive: "border-transparent bg-primary-pale text-positive-deep",
        negative: "border-transparent bg-[#320707] text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
