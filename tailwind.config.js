/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './**/*.html',
    './**/*.md',
    './assets/js/**/*.js',
    '!./node_modules/**/*',
    '!./_site/**/*'
  ],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        mono:   ['JetBrains Mono', 'monospace'],
      },
      colors: {
        k: {
          bg:       '#080b10',
          surface:  '#0f1318',
          surface2: '#141a23',
          surface3: '#1a2232',
          border:   '#1c2535',
          border2:  '#243044',
          accent:   '#3b82f6',
          gold:     '#f59e0b',
          text:     '#edf2f7',
          sub:      '#6b7a8d',
          muted:    '#2a3547',
          ok:       '#34d399',
          error:    '#ef4444',
          warn:     '#f59e0b',
        }
      }
    }
  },
  plugins: []
}