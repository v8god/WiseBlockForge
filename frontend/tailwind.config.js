/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          app: 'var(--bg-app)',
          panel: 'var(--bg-panel)',
          card: 'var(--bg-card)',
          hover: 'var(--bg-hover)',
        },
        border: 'var(--border-color)',
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        node: {
          blue: 'var(--color-blue)',
          orange: 'var(--color-orange)',
          teal: 'var(--color-teal)',
          green: 'var(--color-green)',
          red: 'var(--color-red)',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
