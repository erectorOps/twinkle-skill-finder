import { defineConfig } from 'vite';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  base: '/twinkle-skill-finder/',
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        assetFileNames: 'css/[name][extname]',
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name].js',
      }
    }
  },
  css: {
    postcss: {
      plugins: [autoprefixer()]
    }
  },
  server: {
    open: true
  }
});
