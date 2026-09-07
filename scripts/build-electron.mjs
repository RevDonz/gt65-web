import { build } from 'esbuild';

await build({
  entryPoints: ['electron/main.ts'],
  outfile: 'dist-electron/main.cjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['electron'],
  sourcemap: false,
  logLevel: 'info',
});
