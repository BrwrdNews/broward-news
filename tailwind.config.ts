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
        brand: {
          red: "#cc0000",
          dark: "#1a1a1a",
          gray: "#f5f5f5",
        },
      },
      fontFamily: {
        headline: ["Georgia", "serif"],
        body: ["system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
