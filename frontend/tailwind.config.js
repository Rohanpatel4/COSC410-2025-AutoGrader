/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Using color-mix() to enable Tailwind opacity modifiers (bg-primary/10, etc.)
        background: "color-mix(in srgb, var(--background) calc(<alpha-value> * 100%), transparent)",
        foreground: "color-mix(in srgb, var(--foreground) calc(<alpha-value> * 100%), transparent)",
        card: {
          DEFAULT: "color-mix(in srgb, var(--card) calc(<alpha-value> * 100%), transparent)",
          foreground: "color-mix(in srgb, var(--card-foreground) calc(<alpha-value> * 100%), transparent)",
        },
        primary: {
          DEFAULT: "color-mix(in srgb, var(--primary) calc(<alpha-value> * 100%), transparent)",
          foreground: "color-mix(in srgb, var(--primary-foreground) calc(<alpha-value> * 100%), transparent)",
        },
        muted: {
          DEFAULT: "color-mix(in srgb, var(--muted) calc(<alpha-value> * 100%), transparent)",
          foreground: "color-mix(in srgb, var(--muted-foreground) calc(<alpha-value> * 100%), transparent)",
        },
        accent: {
          DEFAULT: "color-mix(in srgb, var(--accent) calc(<alpha-value> * 100%), transparent)",
          foreground: "color-mix(in srgb, var(--accent-foreground) calc(<alpha-value> * 100%), transparent)",
        },
        danger: {
          DEFAULT: "color-mix(in srgb, var(--danger) calc(<alpha-value> * 100%), transparent)",
          foreground: "color-mix(in srgb, var(--danger-foreground) calc(<alpha-value> * 100%), transparent)",
        },
        warning: {
          DEFAULT: "color-mix(in srgb, var(--warning) calc(<alpha-value> * 100%), transparent)",
          foreground: "color-mix(in srgb, var(--warning-foreground) calc(<alpha-value> * 100%), transparent)",
        },
        border: "color-mix(in srgb, var(--border) calc(<alpha-value> * 100%), transparent)",
        ring: "color-mix(in srgb, var(--ring) calc(<alpha-value> * 100%), transparent)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          "monospace",
        ],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.35rem",
      },
      boxShadow: {
        soft: "0 20px 35px -20px rgba(0, 0, 0, 0.6)",
        glow: "0 25px 45px -20px rgba(136, 110, 76, 0.4)",
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      backgroundImage: {
        "grid-radial":
          "radial-gradient(circle at center, rgba(136, 110, 76, 0.12) 0%, rgba(26, 26, 27, 0) 65%)",
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};

