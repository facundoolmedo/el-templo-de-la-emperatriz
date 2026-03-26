// server.js
require('dotenv').config();

const express = require('express');
const path    = require('path');
const cors    = require('cors');

const authRoutes  = require('./routes/auth');
const postRoutes  = require('./routes/posts');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ──────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.SITE_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos: imágenes subidas + frontend
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// ─── RUTAS API ───────────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/posts', postRoutes);

// ─── HEALTH CHECK ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── SPA FALLBACK ────────────────────────────────────────────────────
// Todas las rutas que no sean /api sirven el index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── ERROR HANDLER ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Archivo demasiado grande. Máximo 50MB.' });
  }
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// ─── INICIAR ─────────────────────────────────────────────────────────
const { initDBWrapper } = require('./db/database');

// Inicializar BD (si no fue hecho por init.js)
async function startServer() {
  try {
    await initDBWrapper();
    
    app.listen(PORT, () => {
      console.log(`
  ✦ ─────────────────────────────────────────── ✦
      TEMPLO DE LA EMPERATRIZ · Backend
      Corriendo en http://localhost:${PORT}
  ✦ ─────────────────────────────────────────── ✦
  `);
    });
  } catch (err) {
    console.error('✗ Error inicializando aplicación:', err);
    process.exit(1);
  }
}

startServer();
