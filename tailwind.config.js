/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        clinicBlue: "#2b84bd",
        clinicPanel: "#b9d6ee",
        clinicInk: "#173553"
      }
    }
  },
  plugins: []
};
