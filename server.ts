import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import app from './src/server/app';

const rootDir = process.cwd();

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
    const distPath = path.join(rootDir, 'dist');
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
