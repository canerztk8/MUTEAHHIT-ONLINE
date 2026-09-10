import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  build: {
    outDir: '../client/dist',
    emptyOutDir: true,
    // PeerJS tarayıcı bundle'ı için
    chunkSizeWarningLimit: 700,
    commonjsOptions: {
      include: [/peerjs/, /node_modules/]
    },
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          physics: ['cannon-es'],
          vendor: ['react', 'react-dom', 'peerjs', 'lucide-react']
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      // /api → Node.js Express sunucusu (health check ve static serve)
      '/api': {
        target: 'http://localhost:3000'
      },
      // /peerjs → Kendi PeerJS sinyal sunucumuz (peer npm paketi)
      '/peerjs': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  },
  optimizeDeps: {
    include: ['peerjs']
  }
});
