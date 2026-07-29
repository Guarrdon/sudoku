import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // so a built copy works from a plain folder or any subpath
  server: { open: true },
  build: { target: 'es2020' },
})
