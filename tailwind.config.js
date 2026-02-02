/** @type {import('tailwindcss').Config} */
export default {
  content: [
    // 告诉 Tailwind 在哪里查找类名，这样它才知道哪些 CSS 需要保留
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 可以在这里扩展 Tailwind 的主题配置
      // 比如自定义颜色、字体等
    },
  },
  plugins: [],
}
