import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: { outDir: 'dist/web' },
  server: { port: 5173, proxy: { '/api': 'http://localhost:4200' } },
  esbuild: { tsconfigRaw: { compilerOptions: { jsx: 'react-jsx' } } }
})
