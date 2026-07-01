/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#08090c",
        obsidian: {
          50: "#f4f4f6",
          100: "#e9e9ed",
          200: "#c7c7d4",
          300: "#a5a6ba",
          400: "#626487",
          500: "#1f2254",
          600: "#1c1e4c",
          700: "#171a3f",
          800: "#121533",
          900: "#0D0E12",
          950: "#12131A",
        },
        accent: {
          purple: "#6C63FF",
          teal: "#22D3EE",
          pink: "#F472B6",
          green: "#34D399",
          yellow: "#FBBF24",
          blue: "#60A5FA",
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-strong': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-slower': 'pulse 10s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-1': 'float1 18s ease-in-out infinite',
        'float-2': 'float2 24s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
