// Build für die native iOS-Hülle: Basis `/`, kein Service Worker, dazu rest.wav für die Pausen-Mitteilung.
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { beepWav } from '../src/lockScreen.ts';

const restWav: Plugin = {
  name: 'rest-wav',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'rest.wav', source: beepWav() });
  },
};

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  base: '/',
  build: { outDir: fileURLToPath(new URL('www', import.meta.url)), emptyOutDir: true },
  plugins: [react(), VitePWA({ disable: true }), restWav],
  define: { __APP_VERSION__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
});
