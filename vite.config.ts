import { defineConfig } from 'vite'

export default defineConfig({
  // sw.js, manifest.json und icons/ müssen für Production-Builds
  // in public/ liegen (oder via vite-plugin-pwa gehandelt werden).
  // Im Dev-Server (`vite dev`) werden alle Root-Dateien direkt ausgeliefert.
  server: {
    hmr: true,
  },
})
