/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#09090B",
        card: "#111827",
        primary: {
          DEFAULT: "#6366F1",
          soft: "#818CF8",
          deep: "#4F46E5",
        },
        accent: {
          DEFAULT: "#8B5CF6",
          soft: "#A78BFA",
        },
        success: "#22C55E",
        danger: "#EF4444",
        warning: "#F59E0B",
        muted: "#94A3B8",
        line: "rgba(148, 163, 184, 0.12)",
      },
      fontFamily: {
        sans: ["Inter", "Inter Variable", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.37)",
        glow: "0 0 24px rgba(99, 102, 241, 0.35)",
        "glow-accent": "0 0 24px rgba(139, 92, 246, 0.35)",
        soft: "0 4px 24px rgba(0, 0, 0, 0.25)",
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
        "gradient-aurora":
          "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(99,102,241,0.28), transparent), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(139,92,246,0.22), transparent)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(0.6)", opacity: "0.5" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s linear infinite",
        "fade-up": "fade-up 0.35s ease-out both",
        "pulse-dot": "pulse-dot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
