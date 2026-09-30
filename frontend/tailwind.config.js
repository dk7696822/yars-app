/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        num: ['Sora', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: "rgb(var(--c-canvas) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        raised: "rgb(var(--c-raised) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        ink: { DEFAULT: "rgb(var(--c-ink) / <alpha-value>)", 2: "rgb(var(--c-ink-2) / <alpha-value>)" },
        brass: { DEFAULT: "rgb(var(--c-brass) / <alpha-value>)", on: "rgb(var(--c-on-brass) / <alpha-value>)" },
        status: {
          good: "rgb(var(--c-good) / <alpha-value>)", warn: "rgb(var(--c-warn) / <alpha-value>)",
          serious: "rgb(var(--c-serious) / <alpha-value>)", critical: "rgb(var(--c-critical) / <alpha-value>)",
        },
        chart: {
          sales: "rgb(var(--c-sales) / <alpha-value>)", collected: "rgb(var(--c-collected) / <alpha-value>)",
          kg: "rgb(var(--c-kg) / <alpha-value>)", expense: "rgb(var(--c-expense) / <alpha-value>)",
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
    },
  },
  plugins: [],
};
