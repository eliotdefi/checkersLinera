import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        board: {
          light: "#f0d9b5",
          dark: "#b58863",
        },
        piece: {
          red: "#dc2626",
          redKing: "#991b1b",
          black: "#1f2937",
          blackKing: "#111827",
        },
        linera: {
          navy: "#0A1F27",
          "navy-light": "#0F2832",
          red: "#DE2A02",
          accent: "#8D96FF",
          gray: "#C8CBD6",
          light: "#EDEDF9",
        },
      },
    },
  },
  plugins: [],
};

export default config;
