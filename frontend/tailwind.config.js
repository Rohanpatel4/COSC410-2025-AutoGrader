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
        primary: "#2860E1",
        "primary-dark": "#1F4AB4",
        accent: "#00A4A6",
        danger: "#D64545",
        warning: "#E6A700",
        "neutral-50": "#F7F8FB",
        "neutral-100": "#E6E8EF",
        "neutral-900": "#0E1327",
        "background-dark": "#0F1220",
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
        soft: "0 20px 35px -20px rgba(14, 19, 39, 0.26)",
        glow: "0 25px 45px -20px rgba(40, 96, 225, 0.45)",
      },
      transitionTimingFunction: {
        soft: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      backgroundImage: {
        "grid-radial":
          "radial-gradient(circle at center, rgba(40, 96, 225, 0.12) 0%, rgba(15, 18, 32, 0) 65%)",
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};

