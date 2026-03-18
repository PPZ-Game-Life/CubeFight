import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          three: ['three'],
          r3f: ['@react-three/fiber'],
          drei: ['@react-three/drei'],
          postprocessing: ['@react-three/postprocessing']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
