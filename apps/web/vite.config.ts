import { resolve } from 'node:path';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tasko/types': resolve(__dirname, '../../packages/types/src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:7373',
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-tanstack': ['@tanstack/react-query', '@tanstack/react-router', '@tanstack/react-virtual'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable'],
          'vendor-markdown': ['marked', 'dompurify'],
        },
      },
    },
  },
});
