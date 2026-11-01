import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Custom font sizes from tailwind.config.ts. Without these, twMerge reads text-button-sm
// as a text colour and drops the real one, such as text-primary-foreground.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-mega",
            "display-xxl",
            "display-xl",
            "display-lg",
            "display-md",
            "display-sm",
            "display-xs",
            "title-md",
            "title-sm",
            "body-md",
            "body-sm",
            "caption",
            "caption-sm",
            "badge",
            "micro-label",
            "button-md",
            "button-sm",
            "nav-link",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
