/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // Palette follows the 60/30/10 rule:
      //  60% dominant  -> background / card (neutral surfaces, most of the screen)
      //  30% secondary -> line / muted / slate-700-ish surfaces (borders, secondary text, hover states)
      //  10% accent    -> primary (the one brand hue; accent is an alias of it, not a second color)
      colors: {
        background: "#0A0A0C",
        card: "#131316",
        primary: {
          DEFAULT: "#6366F1",
          soft: "#818CF8",
          deep: "#4F46E5",
        },
        // Alias of primary — kept as a separate token only so existing
        // `accent-soft` / `text-accent-soft` usages don't need renaming, not
        // because it's a second hue in the palette.
        accent: {
          DEFAULT: "#6366F1",
          soft: "#818CF8",
        },
        success: "#22C55E",
        danger: "#EF4444",
        warning: "#F59E0B",
        muted: "#9A9AA5",
        line: "rgba(161, 161, 170, 0.12)",
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
        // A subtle lift on the ~10% accent surfaces (primary CTA), not a neon halo.
        glow: "0 2px 14px rgba(99, 102, 241, 0.22)",
        "glow-accent": "0 2px 14px rgba(99, 102, 241, 0.22)",
        soft: "0 4px 24px rgba(0, 0, 0, 0.25)",
      },
      backgroundImage: {
        // Single-hue gradient (no second accent color) for the small set of
        // primary CTA surfaces.
        "gradient-brand": "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
        // Barely-there depth cue behind the shell — kept minimal so the
        // accent hue doesn't dominate the screen.
        "gradient-aurora": "radial-gradient(ellipse 70% 40% at 20% -10%, rgba(99,102,241,0.08), transparent)",
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
