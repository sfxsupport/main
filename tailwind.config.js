/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./*.html",                  // root-level HTML files
      "./src/**/*.{html,js}",      // all HTML and JS in src folder
      "./_includes/**/*.{html,liquid}", // if using Jekyll's _includes
      "./_layouts/**/*.{html,liquid}",  // Jekyll layouts
      "./_includes/*.{html,liquid}",
      "/Resources/*.html",
      "/Resources/**/*.html",
      "/_layouts/*.html",
      "/learning.html",
      "/_includes/*.html"
    ],
    theme: {
      extend: {},
    },
    plugins: [],
  };
  