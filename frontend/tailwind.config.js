/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        pulse: {
          DEFAULT: "#5B2A9E",
          50: "#F3EDFB",
          100: "#E5D8F6",
          200: "#C8AFEC",
          300: "#AB86E2",
          400: "#8D5DD3",
          500: "#5B2A9E",
          600: "#4A2280",
          700: "#391A62",
          800: "#281244",
          900: "#1C1230",
        },
        ember: {
          DEFAULT: "#FF6B5B",
          100: "#FFE2DD",
          300: "#FFA598",
          500: "#FF6B5B",
          700: "#E24E3F",
        },
        sunbeam: {
          DEFAULT: "#FFB454",
          300: "#FFD08F",
          500: "#FFB454",
          700: "#E0932E",
        },
        meadow: {
          DEFAULT: "#3FB68B",
          100: "#DDF5EC",
          500: "#3FB68B",
          700: "#2C8E6B",
        },
        paper: "#F6F3FC",
        midnight: "#1C1230",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Plus Jakarta Sans'", "sans-serif"],
        mono: ["'Space Mono'", "monospace"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "0 8px 30px -12px rgba(28, 18, 48, 0.25)",
        pop: "0 12px 40px -8px rgba(91, 42, 158, 0.35)",
      },
    },
  },
  plugins: [],
};
