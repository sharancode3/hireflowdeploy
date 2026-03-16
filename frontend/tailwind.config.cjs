/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        border: "var(--border)",
        "border-active": "var(--border-active)",
        text: "var(--text)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        accent: "var(--accent)",
        "accent-teal": "var(--accent-teal)",
        "accent-purple": "var(--accent-purple)",
        "accent-amber": "var(--accent-amber)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        xs: "12px",
        sm: "14px",
        base: "16px",
        lg: "20px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "48px",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0, 0, 0, 0.25)",
        lift: "0 14px 40px rgba(0, 0, 0, 0.3)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "float-up": {
          "0%": { transform: "translateY(0px)", opacity: "0.6" },
          "100%": { transform: "translateY(-24px)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-8px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shake: {
          "0%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "50%": { transform: "translateX(4px)" },
          "75%": { transform: "translateX(-3px)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.3s ease-out",
        "float-up": "float-up 6s ease-in-out infinite alternate",
        shimmer: "shimmer 1.8s linear infinite",
        "slide-in-left": "slide-in-left 0.15s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        shake: "shake 0.3s ease-in-out",
      },
      transitionTimingFunction: {
        "ease-soft": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
