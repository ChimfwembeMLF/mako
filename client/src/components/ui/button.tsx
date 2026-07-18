import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-button-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-active active:bg-primary-active disabled:bg-primary-disabled",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-foreground bg-background text-foreground hover:bg-surface-soft",
        secondary:
          "border border-foreground bg-background text-foreground hover:bg-surface-soft",
        ghost: "hover:bg-surface-soft hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
        pill: "rounded-full bg-primary text-primary-foreground text-button-sm hover:bg-primary-active px-5 py-2.5 h-auto",
      },
      size: {
        default: "h-12 px-6 py-3.5",
        sm: "h-10 rounded-sm px-4 text-button-sm",
        lg: "h-12 rounded-sm px-8",
        icon: "h-10 w-10 rounded-full",
        orb: "h-12 w-12 rounded-full p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
