import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-sm border border-input bg-background px-3 py-3 text-body-md ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground disabled:cursor-not-allowed disabled:bg-surface-soft",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
