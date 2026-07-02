import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
      },
      borderRadius: {
        lg: "1rem",
        md: "0.8rem",
        sm: "0.6rem",
      },
      boxShadow: {
        soft: "0 24px 60px -30px rgba(18, 56, 61, 0.35)",
      },
      backgroundImage: {
        "hero-grid":
          "linear-gradient(to right, rgba(9, 56, 66, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(9, 56, 66, 0.08) 1px, transparent 1px)",
      },
      backgroundSize: {
        "hero-grid": "36px 36px",
      },
    },
  },
  plugins: [],
};

export default config;
