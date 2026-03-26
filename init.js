// init.js
// Script que se ejecuta al iniciar el contenedor
// Verifica si existe el usuario admin y lo crea si es necesario
// Luego arranca el servidor

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initDBWrapper, queries } = require('./db/database');

async function initialize() {
  console.log('\n  ✦ Inicializando Templo de la Emperatriz\n');

  try {
    // Inicializar base de datos
    await initDBWrapper();
    console.log('  ✓ Base de datos inicializada');

    // Verificar si ya existe un usuario admin
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@templo.local').toLowerCase();
    const existing = queries.findUserByEmail.get(adminEmail);

    if (!existing) {
      // Crear usuario admin
      const password = process.env.ADMIN_PASSWORD || 'admin';
      const hashedPassword = await bcrypt.hash(password, 12);

      queries.createUser.run({
        email: adminEmail,
        password: hashedPassword,
        name: 'La Emperatriz',
        role: 'admin',
      });

      console.log('  ✓ Usuario administrador creado:');
      console.log(`    Email: ${adminEmail}`);
      console.log(`    Rol: admin\n`);
    } else {
      console.log(`  ✓ Usuario administrador ya existe: ${adminEmail}\n`);
    }

    // Iniciar el servidor
    require('./server');

  } catch (err) {
    console.error('  ✗ Error durante la inicialización:', err.message);
    process.exit(1);
  }
}

// Ejecutar inicialización
initialize().catch(err => {
  console.error('  ✗ Error fatal:', err.message);
  process.exit(1);
});
