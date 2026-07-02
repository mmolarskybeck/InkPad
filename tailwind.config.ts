import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans, Inter)", "sans-serif"],
        // liga/calt off keeps -> and === as literal characters (no ligature glyphs)
        mono: [["JetBrains Mono", "monospace"], { fontFeatureSettings: "\"liga\" 0, \"calt\" 0" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        "editor-bg": "var(--editor-bg)",
        "panel-bg": "var(--panel-bg)",
        "border-color": "var(--border-color)",
        "accent-blue": "var(--accent-blue)",
        "secondary-blue": "var(--secondary-blue)",
        "text-primary": "var(--text-primary)",
        "text-emphasis": "var(--text-emphasis)",
        "text-secondary": "var(--text-secondary)",
        success: "var(--success)",
        error: "var(--error)",
        warning: "var(--warning)",
        "syntax-keyword": "var(--syntax-keyword)",
        "syntax-string": "var(--syntax-string)",
        "syntax-number": "var(--syntax-number)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
