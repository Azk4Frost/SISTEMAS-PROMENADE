module.exports = {
  content: [
    './PROMENADEHUB/sistemas/gestao_de_uniforme/*.{html,js}',
    './PROMENADEHUB/js/components/*.js'
  ],
  theme: {
    extend: {
      colors: { promenade: { 50: '#eff6ff', 100: '#dceaff', 600: '#0761c8', 700: '#09539a', 900: '#172951' } },
      fontFamily: { sans: ['Arial', 'Helvetica', 'sans-serif'] }
    }
  },
  plugins: []
};
