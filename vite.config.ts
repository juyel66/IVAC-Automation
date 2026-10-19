import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isContentScript = mode === 'content' || process.env.BUILD_TARGET === 'content';
  const isBackground = mode === 'background' || process.env.BUILD_TARGET === 'background';

  if (isContentScript) {
    return {
      plugins: [react()],
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      build: {
        emptyOutDir: false,
        outDir: 'dist',
        lib: {
          entry: resolve(__dirname, 'src/content/index.tsx'),
          name: 'IvacContentScript',
          formats: ['iife'],
          fileName: () => 'content.js',
        },
      },
    };
  }

  if (isBackground) {
    return {
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      build: {
        emptyOutDir: false,
        outDir: 'dist',
        lib: {
          entry: resolve(__dirname, 'src/background/serviceWorker.ts'),
          name: 'IvacBackgroundWorker',
          formats: ['es'],
          fileName: () => 'background.js',
        },
      },
    };
  }

  // Default build: Popup UI & HTML
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'index.html'),
        },
      },
    },
  };
});
