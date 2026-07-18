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
          "Circular",
          "-apple-system",
          "system-ui",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
        display: [
          "Inter",
          "Circular",
          "-apple-system",
          "system-ui",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      fontSize: {
        "display-xl": ["28px", { lineHeight: "1.43", fontWeight: "700", letterSpacing: "0" }],
        "display-lg": ["22px", { lineHeight: "1.18", fontWeight: "500", letterSpacing: "-0.44px" }],
        "display-md": ["21px", { lineHeight: "1.43", fontWeight: "700", letterSpacing: "0" }],
        "display-sm": ["20px", { lineHeight: "1.2", fontWeight: "600", letterSpacing: "-0.18px" }],
        "title-md": ["16px", { lineHeight: "1.25", fontWeight: "600", letterSpacing: "0" }],
        "title-sm": ["16px", { lineHeight: "1.25", fontWeight: "500", letterSpacing: "0" }],
        "body-md": ["16px", { lineHeight: "1.5", fontWeight: "400", letterSpacing: "0" }],
        "body-sm": ["14px", { lineHeight: "1.43", fontWeight: "400", letterSpacing: "0" }],
        caption: ["14px", { lineHeight: "1.29", fontWeight: "500", letterSpacing: "0" }],
        "caption-sm": ["13px", { lineHeight: "1.23", fontWeight: "400", letterSpacing: "0" }],
        badge: ["11px", { lineHeight: "1.18", fontWeight: "600", letterSpacing: "0" }],
        "micro-label": ["12px", { lineHeight: "1.33", fontWeight: "700", letterSpacing: "0" }],
        "button-md": ["16px", { lineHeight: "1.25", fontWeight: "500", letterSpacing: "0" }],
        "button-sm": ["14px", { lineHeight: "1.29", fontWeight: "500", letterSpacing: "0" }],
        "nav-link": ["16px", { lineHeight: "1.25", fontWeight: "600", letterSpacing: "0" }],
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
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          active: "hsl(var(--primary-active))",
          disabled: "hsl(var(--primary-disabled))",
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
        md: "14px",
        lg: "20px",
        xl: "32px",
        full: "9999px",
      },
      spacing: {
        xxs: "2px",
        section: "64px",
      },
      boxShadow: {
        elevated:
          "rgba(0, 0, 0, 0.02) 0 0 0 1px, rgba(0, 0, 0, 0.04) 0 2px 6px 0, rgba(0, 0, 0, 0.1) 0 4px 8px 0",
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
