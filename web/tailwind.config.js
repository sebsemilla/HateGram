/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        hate: {
          red: "#E63946",
          dark: "#0D0D0D",
          gray: "#1A1A1A",
          light: "#2A2A2A",
        },
      },
    },
  },
  plugins: [],
};
