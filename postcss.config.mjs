/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
    './postcss-oklch-to-rgb.js': {},
    'autoprefixer': {},
  },
};

export default config;
