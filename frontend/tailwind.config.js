export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef7f4',
          100: '#dceee7',
          200: '#b9dfce',
          300: '#8cc9b2',
          400: '#5fab91',
          500: '#35886f',
          600: '#17614f',
          700: '#134e40',
          800: '#103f35',
          900: '#0e332d',
        },
        teal: {
          50: '#f0fdfa',
          500: '#14b8a6',
          600: '#0d9488',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
