// scripts/reset-password.js
// Usar si olvidaste la contraseña o querés cambiarla
// Ejecutar: node scripts/reset-password.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { db, queries } = require('../db/database');

async function reset() {
  console.log('\n  ✦ Restablecer contraseña · Templo de la Emperatriz\n');

  const email    = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('  ✗ Falta ADMIN_EMAIL o ADMIN_PASSWORD en .env\n');
    process.exit(1);
  }

  const user = queries.findUserByEmail.get(email.toLowerCase());
  if (!user) {
    console.error(`  ✗ No existe usuario con email: ${email}\n`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 12);
  db.prepare('UPDATE users SET password = ? WHERE email = ?').run(hashed, email.toLowerCase());

  console.log(`  ✓ Contraseña actualizada para: ${email}\n`);
  process.exit(0);
}

reset().catch(err => {
  console.error('  ✗ Error:', err.message);
  process.exit(1);
});
