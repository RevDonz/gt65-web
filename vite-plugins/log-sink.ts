import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin, Connect } from 'vite';

const LOG_DIR = 'logs';
const LOG_FILE = 'session.log';
const ENDPOINT = '/__log';

/**
 * Baca seluruh body request sebagai teks. Entri log satu transaksi jauh
 * lebih kecil dari batas apa pun yang wajar di sini, jadi tidak ada
 * penjagaan ukuran — ini alat bantu debug lokal, bukan endpoint publik.
 */
function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Plugin dev-server: terima POST teks/JSON di `/__log` dan tambahkan ke
 * `logs/session.log`, supaya log transaksi mendarat di disk otomatis saat
 * pengembangan tanpa langkah salin-tempel manual.
 *
 * `apply: 'serve'` membuatnya benar-benar tidak ada di `vite build` —
 * middleware ini tidak pernah terdaftar sewaktu build produksi, jadi tidak
 * mungkin ikut ke berkas yang dideploy ke GitHub Pages.
 */
export function logSinkPlugin(): Plugin {
  return {
    name: 'gt65-log-sink',
    apply: 'serve',
    configureServer(server) {
      const logPath = path.join(server.config.root, LOG_DIR, LOG_FILE);

      server.middlewares.use(ENDPOINT, async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          res.end('Method Not Allowed');
          return;
        }

        try {
          const body = await readBody(req);
          await mkdir(path.dirname(logPath), { recursive: true });
          await appendFile(logPath, body.endsWith('\n') ? body : `${body}\n`, 'utf8');
          res.statusCode = 204;
          res.end();
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    },
  };
}
