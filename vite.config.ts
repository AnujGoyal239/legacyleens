import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/trpc': {
        target: process.env.API_URL || 'http://localhost:3000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const headers = req.headers as Record<string, string | undefined>;
            if (headers.authorization) proxyReq.setHeader('Authorization', headers.authorization);
            if (headers['x-access-token']) proxyReq.setHeader('x-access-token', headers['x-access-token']);
          });
        },
      },
      '/uploads': {
        target: process.env.API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // disable in prod to reduce bundle size
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Clerk auth
          'vendor-clerk': ['@clerk/clerk-react'],
          // tRPC + React Query
          'vendor-trpc': ['@trpc/client', '@trpc/react-query', '@tanstack/react-query', 'superjson'],
          // UI / charts
          'vendor-charts': ['recharts', 'd3'],
          // DnD
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
});
