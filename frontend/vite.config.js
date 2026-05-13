import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path' // Optimized import

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // This forces ALL libraries to use your project's version of React
      'react': resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  server: {
    port: 5000,
    host: true,
  },
})