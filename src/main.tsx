import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { sendToDevLogSink, sessionHeaderLine } from './app/devLogSink';
import './index.css';

// Tandai batas sesi di logs/session.log (dev only) supaya beberapa proses
// `npm run dev` yang berbeda tetap bisa dibedakan dalam satu berkas yang
// terus ditambahi. Tidak berefek apa pun di build produksi — lihat
// devLogSink.ts.
sendToDevLogSink(sessionHeaderLine(new Date()));

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
