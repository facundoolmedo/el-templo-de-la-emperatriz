// scripts/setup.js
// Ejecutar UNA SOLA VEZ con: node scripts/setup.js
// Crea el usuario administrador en la base de datos

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { initDBWrapper, queries } = require('../db/database');

async function setup() {
  console.log('\n  ✦ Setup · Templo de la Emperatriz\n');

  const email    = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name     = 'La Emperatriz';

  if (!email || !password) {
    console.error('  ✗ Falta ADMIN_EMAIL o ADMIN_PASSWORD en el archivo .env\n');
    process.exit(1);
  }

  // Inicializar base de datos
  try {
    await initDBWrapper();
  } catch (err) {
    console.error('  ✗ Error inicializando la base de datos:', err.message);
    process.exit(1);
  }

  // Verificar si ya existe
  const existing = queries.findUserByEmail.get(email.toLowerCase());
  if (existing) {
    console.log(`  ⚠ Ya existe un usuario con el email: ${email}`);
    console.log('  Si querés cambiar la contraseña, editá el .env y corré: node scripts/reset-password.js\n');
    process.exit(0);
  }

  // Hashear contraseña
  const hashedPassword = await bcrypt.hash(password, 12);

  queries.createUser.run({
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    name,
    role: 'admin',
  });

  console.log('  ✓ Usuario administrador creado exitosamente:');
  console.log(`    Email:    ${email}`);
  console.log(`    Nombre:   ${name}`);
  console.log(`    Rol:      admin`);
  console.log('\n  Ahora podés iniciar el servidor con: npm start\n');
  process.exit(0);
}

setup().catch(err => {
  console.error('  ✗ Error durante el setup:', err.message);
  process.exit(1);
});
