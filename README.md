# El Templo de La Emperatriz - Guía de Proyecto

Bienvenido a la documentación de **El Templo de La Emperatriz**.
Esta web está construida con una arquitectura nativa, ligera y rápida que **no requiere compilación**:
- **Frontend:** HTML, CSS y JavaScript vainilla (un solo archivo `index.html` que actúa de forma dinámica).
- **Backend:** PHP 8.2 (API RESTful limpia sin frameworks).
- **Base de Datos:** MySQL.

---

## 🛠️ Desarrollo Local (Cómo probar en tu compu)

Si otro desarrollador quiere probar o hacer cambios en la computadora antes de subirlos, el proyecto incluye un entorno pre-configurado usando **Docker**. 

1. Necesitas tener [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y abierto.
2. Abre una terminal de comandos, dirígete a esta carpeta y ejecuta:
   ```bash
   docker-compose up -d --build
   ```
3. Abre tu navegador y ve a `http://localhost:8080`.
4. El panel de administrador estará accesible desde el botón con forma de **ojo** (Login) integrado al final de la página. Las credenciales de prueba allí son:
   - **User:** `admin`
   - **Pass:** `admin`

---

## 🚀 Despliegue en Producción (Subir a Hostinger)

El entorno de Hostinger Premium está preparado nativamente para PHP. **NO hay pasos de compilación, ni repositorios de GIT obligatorios, ni carpetas Node.js y NO debes usar el botón de "Redeploy" o "AutoInstaller".**

Aquí están los pasos simplificados:

### A. Si es la PRIMERA VEZ que subes el proyecto:

#### 1. Crear la Base de Datos
1. Entra a tu panel de Hostinger y ve a **Bases de datos -> Bases de datos MySQL**.
2. Crea una base de datos nueva. **Anota muy bien** el nombre de la BD, el usuario y la contraseña que inventaste allí.
3. Haz clic en el botón de **Entrar a phpMyAdmin** que aparecerá al lado de tu nueva BD.
4. Una vez en phpMyAdmin, ve a la pestaña **SQL** en el panel superior.
5. Abre el archivo de tu computadora llamado `setup.sql`, copia absolutamente todo el texto, pégalo en la ventana de SQL de phpMyAdmin y dale a **Continuar**. Esto "armará" las estructuras.

#### 2. Subir los Archivos (Arrastrar y Soltar)
1. Ve al **Administrador de Archivos** de Hostinger y entra a la carpeta `public_html`.
2. Si por algún intento anterior hay archivos o carpetas raras adentro (como `.build` o cosas de node), **borra todo** para que tu `public_html` quede completamente vacía.
3. Asegúrate de tener activada la opción **"Mostrar archivos ocultos"** (en Settings / Ajustes arriba a la derecha).
4. **Arrastra y suelta directamete desde Windows hacia el navegador** los siguientes elementos:
   - `index.html`
   - `api/` (Toda la carpeta completa con todo adentro).
   - `.htaccess` (Súper importante para que funcionen las rutas amigables).
   *(Si Windows por ser un archivo oculto no te deja arrastrar `.htaccess`, créalo manualmente en Hostinger dándole a "Nuevo Archivo", llámalo `.htaccess` y pega su código adentro).*

#### 3. Conectar la Base de Datos (.env)
1. En tu `public_html` de Hostinger, crea un "Nuevo Archivo" llamado obligatoriamente **`.env`** (con el punto al inicio).
2. Pega lo siguiente y reemplaza los valores de la Base de Datos por los tuyos reales del paso 1:
```env
DB_HOST=localhost
DB_USER=tusuario_de_hostinger_completo
DB_PASS=tu_contraseña_secreta_aqui
DB_NAME=tunombedb_en_hostinger_completo

ADMIN_EMAIL=admin
ADMIN_PASSWORD=admin
JWT_SECRET=escribe_aqui_una_clave_aleatoria_larga
```
3. Guarda el archivo. ¡Listo! Tu página web ya está 100% online y operativa. 

---

### B. Si quieres ACTUALIZAR la web en el futuro (Realizar un cambio):

Subir actualizaciones futuras en esta arquitectura es **increíblemente fácil y rápido**. 

1. Realiza los cambios de código, color o diseño localmente en tu computadora. Por ejemplo: si modificaste una frase en `index.html`, o la lógica del login en `api/auth.php`.
2. Ve al **Administrador de Archivos** de Hostinger -> `public_html`.
3. Arrastra desde tu computadora únicamente el **archivo individual** que cambiaste (ej: `index.html`) hacia el navegador web, y elige **Reemplazar** archivo antiguo.
4. **¡Y ya está!** Al recargar tu página web desde el celular o navegador web los cambios estarán visualmente *"en vivo"* al instante. Ni botones mágicos, ni deploys, ni comandos en terminal.
