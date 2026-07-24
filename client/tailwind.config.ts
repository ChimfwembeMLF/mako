import type { Config } from "tailwindcss";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default {
  darkMode: ["class"],
  content: [
    path.join(dir, "index.html"),
    path.join(dir, "src/**/*.{ts,tsx}"),
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        display: [
          "Manrope",
          "Inter",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      fontSize: {
        "display-mega": ["clamp(2.75rem, 8vw, 7.875rem)", { lineHeight: "0.85", fontWeight: "800", letterSpacing: "-0.02em" }],
        "display-xxl": ["clamp(2.5rem, 6vw, 6rem)", { lineHeight: "0.85", fontWeight: "800", letterSpacing: "-0.02em" }],
        "display-xl": ["clamp(2.25rem, 5vw, 4rem)", { lineHeight: "0.9", fontWeight: "800", letterSpacing: "-0.02em" }],
        "display-lg": ["2.5rem", { lineHeight: "1.2", fontWeight: "400", letterSpacing: "-0.108px" }],
        "display-md": ["2.5rem", { lineHeight: "0.85", fontWeight: "800", letterSpacing: "0" }],
        "display-sm": ["2rem", { lineHeight: "1.2", fontWeight: "600", letterSpacing: "-0.96px" }],
        "display-xs": ["1.5rem", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "-0.48px" }],
        "title-md": ["16px", { lineHeight: "1.25", fontWeight: "600", letterSpacing: "0" }],
        "title-sm": ["16px", { lineHeight: "1.25", fontWeight: "500", letterSpacing: "0" }],
        "body-md": ["16px", { lineHeight: "1.5", fontWeight: "400", letterSpacing: "0" }],
        "body-sm": ["14px", { lineHeight: "1.43", fontWeight: "400", letterSpacing: "0" }],
        caption: ["12px", { lineHeight: "1.33", fontWeight: "400", letterSpacing: "0" }],
        "caption-sm": ["12px", { lineHeight: "1.33", fontWeight: "400", letterSpacing: "0" }],
        badge: ["12px", { lineHeight: "1.33", fontWeight: "600", letterSpacing: "0" }],
        "micro-label": ["12px", { lineHeight: "1.33", fontWeight: "600", letterSpacing: "0" }],
        "button-md": ["16px", { lineHeight: "1.5", fontWeight: "600", letterSpacing: "0" }],
        "button-sm": ["14px", { lineHeight: "1.43", fontWeight: "600", letterSpacing: "0" }],
        "nav-link": ["14px", { lineHeight: "1.43", fontWeight: "600", letterSpacing: "0" }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        body: "hsl(var(--body))",
        "muted-soft": "hsl(var(--muted-soft))",
        "hairline-soft": "hsl(var(--hairline-soft))",
        "border-strong": "hsl(var(--border-strong))",
        "surface-soft": "hsl(var(--surface-soft))",
        "surface-strong": "hsl(var(--surface-strong))",
        "legal-link": "hsl(var(--legal-link))",
        luxe: "hsl(var(--luxe))",
        plus: "hsl(var(--plus))",
        positive: {
          DEFAULT: "hsl(var(--positive))",
          deep: "hsl(var(--positive-deep))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          deep: "hsl(var(--warning-deep))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          active: "hsl(var(--primary-active))",
          disabled: "hsl(var(--primary-disabled))",
          pale: "hsl(var(--primary-pale))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        full: "9999px",
      },
      spacing: {
        xxs: "2px",
        section: "48px",
      },
      boxShadow: {
        elevated: "none",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
} satisfies Config;
