import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { logSinkPlugin } from './vite-plugins/log-sink';


export default defineConfig({
  base: './',
  // logSinkPlugin() sendiri sudah `apply: 'serve'` — tidak pernah aktif
  // sewaktu `vite build`, jadi tidak ikut ke berkas yang dideploy.
  plugins: [react(), tailwindcss(), logSinkPlugin()],
  build: {
    rollupOptions: {
      input: {
        remap: 'index.html',
        profiles: 'profiles.html',
        rgb: 'rgb.html',
        macros: 'macros.html',
        lighting: 'lighting.html',
        tester: 'tester.html',
        settings: 'settings.html',
        monitor: 'monitor.html',
        log: 'log.html',
      },
    },
  },
});
