// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queries } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ─── POST /api/auth/login ────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password, remember } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos.' });
  }

  const user = queries.findUserByEmail.get(email.toLowerCase().trim());

  if (!user) {
    // Respuesta genérica para no revelar si el email existe
    return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
  }

  const passwordOk = await bcrypt.compare(password, user.password);
  if (!passwordOk) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
  }

  // Duración según "recordarme"
  const expiresIn = remember
    ? (process.env.JWT_REMEMBER_EXPIRES_IN || '30d')
    : (process.env.JWT_EXPIRES_IN || '8h');

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    expiresIn,
  });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ─── POST /api/auth/logout ───────────────────────────────────────────
// Con JWT el logout es del lado del cliente (borrar el token)
// Este endpoint es para confirmación
router.post('/logout', requireAuth, (req, res) => {
  res.json({ message: 'Sesión cerrada.' });
});

module.exports = router;
