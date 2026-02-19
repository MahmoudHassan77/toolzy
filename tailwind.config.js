/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Comic Neue"', 'cursive'],
      },
      colors: {
        // Semantic tokens — values come from CSS vars (see index.css)
        bg:      'var(--bg)',      // page/outermost background
        surface: 'var(--surface)', // sidebar, topbar, cards, modals
        raised:  'var(--raised)',  // toolbar row-2, hover states, nested panels
        line:    'var(--line)',    // standard border
        line2:   'var(--line2)',   // stronger border (inputs, dividers)
        fg1:     'var(--fg1)',     // primary text
        fg2:     'var(--fg2)',     // secondary text
        fg3:     'var(--fg3)',     // muted / placeholder
        acc:     'var(--acc)',     // yellow accent (amber)
        acch:    'var(--acch)',    // accent hover
        accon:   'var(--accon)',   // text ON accent (dark on yellow)
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
