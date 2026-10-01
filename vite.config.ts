import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs: the same build is served from any /<repo>/<channel>/ folder.
  base: './',
});
