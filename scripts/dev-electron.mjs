import { spawn } from 'node:child_process';
import electron from 'electron';

const URL_DEV = 'http://localhost:5173';

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await fetch(url);
      return;
    } catch {
      if (Date.now() > deadline) throw new Error(`vite dev server tidak muncul di ${url}`);
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

const vite = spawn('npx', ['vite', '--port', '5173', '--strictPort'], { stdio: 'inherit' });
await waitForServer(URL_DEV);

const app = spawn(electron, ['dist-electron/main.cjs'], {
  stdio: 'inherit',
  env: { ...process.env, GT65_DEV_SERVER_URL: URL_DEV },
});

const stop = () => { app.kill(); vite.kill(); };
app.on('exit', () => { vite.kill(); process.exit(0); });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
