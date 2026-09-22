import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  base: './',
  root: path.resolve(__dirname, 'renderer'),
  build: {
    outDir: path.resolve(__dirname, 'dist'),

    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  }
});
