import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Hashed JS/CSS go to /bundle/ (cached forever by vercel.json); /assets/ stays for the swappable art.
    assetsDir: 'bundle',
    target: 'es2020',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/](three|postprocessing)[\\/]/ },
            { name: 'gsap', test: /node_modules[\\/](gsap|lenis)[\\/]/ },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  optimizeDeps: {
    include: ['three', 'postprocessing', 'gsap', 'lenis', 'simplex-noise'],
  },
  server: {
    // Reachable from a phone on the same Wi-Fi.
    host: true,
  },
});
