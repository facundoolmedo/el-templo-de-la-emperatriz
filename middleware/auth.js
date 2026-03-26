// middleware/auth.js
const jwt = require('jsonwebtoken');
const { queries } = require('../db/database');

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Iniciá sesión primero.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = queries.findUserById.get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Tu sesión expiró. Iniciá sesión nuevamente.', expired: true });
    }
    return res.status(403).json({ error: 'Token inválido.' });
  }
}

module.exports = { requireAuth };
