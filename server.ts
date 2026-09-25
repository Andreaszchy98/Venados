import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import app from './src/server/app.js';

const resolvedFilename = (typeof import.meta !== 'undefined' && (import.meta as any).url)
  ? fileURLToPath((import.meta as any).url)
  : process.argv[1];
const __dirname = path.dirname(resolvedFilename);

const PORT = 3000;

async function startServer() {
  // Vite middleware en desarrollo o archivos estáticos en producción
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VXP Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
