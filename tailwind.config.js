/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{svelte,js}'],
  darkMode: 'class', // toggled by our own theme store, not OS preference — G-07 is an explicit user choice
  theme: {
    extend: {
      colors: {
        // Light theme — values and contrast ratios verified in Colour_Scheme_and_Asset_Direction.md
        surface: '#FAF8F5',
        raised: '#FFFFFF',
        ink: '#1C1A17',
        'ink-secondary': '#57514A',
        'ink-muted': '#6B645C',
        border: '#DED7CC',
        'border-interactive': '#857D73',
        accent: '#8F5314',
        'accent-ink': '#FFFFFF',
        gotit: '#2F6B33',
        'gotit-bg': '#EAF1E7',
        // Dark theme — separate palette, not a filter. Verified as its own 4.5:1/3:1 pass.
        'dark-surface': '#17150F',
        'dark-raised': '#221F19',
        'dark-ink': '#F4F0E9',
        'dark-ink-secondary': '#ADA69C',
        'dark-ink-muted': '#918A80',
        'dark-border': '#3A352D',
        // Raised from #6B645A: the old value cleared 3:1 against dark-surface
        // (3.13) but only reached 2.81 against dark-raised, and this token is
        // the "you can tap this" affordance — it appears on .btn-secondary and
        // on every option button, including inside raised containers. A UI
        // boundary that carries meaning has to hold 3:1 on every background it
        // is used on, not just the most favourable one. Now 3.37 / 3.74.
        'dark-border-interactive': '#787065',
        'dark-accent': '#E3A257',
        'dark-accent-ink': '#17150F',
        'dark-gotit': '#86BE7F',
        'dark-gotit-bg': '#1E2A1C',
      },
      fontFamily: {
        sans: ['Atkinson Hyperlegible', 'Segoe UI', 'Verdana', '-apple-system', 'sans-serif'],
        myanmar: ['Noto Sans Myanmar', 'sans-serif'],
      },
      fontSize: {
        base: ['18px', '1.6'],
        sm: ['16px', '1.6'],
        label: ['14px', '1.4'],
        thesis: ['26px', '1.3'],
        heading: ['22px', '1.3'],
      },
      borderRadius: {
        card: '12px',
        photo: '12px',
      },
    },
  },
  plugins: [],
}
