// db/database.js
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'templo.db');
const dataDir = path.dirname(DB_PATH);

// Variable global para la BD
let db = null;
let SQL = null;

// Inicializar sql.js
async function initDB() {
  SQL = await initSqlJs();
  
  // Crear carpeta si no existe
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Cargar BD existente o crear nueva
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Crear tablas
  createTables();
  saveDB();

  return db;
}

// Guardar BD a archivo
function saveDB() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Crear tablas
function createTables() {
  if (!db) return;

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT    UNIQUE NOT NULL,
      password   TEXT    NOT NULL,
      name       TEXT    NOT NULL DEFAULT 'La Emperatriz',
      role       TEXT    NOT NULL DEFAULT 'admin',
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      content     TEXT    NOT NULL,
      excerpt     TEXT,
      cover_image TEXT,
      video_url   TEXT,
      tags        TEXT    DEFAULT '[]',
      published   INTEGER NOT NULL DEFAULT 1,
      author_id   INTEGER NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (author_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS post_images (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id    INTEGER NOT NULL,
      filename   TEXT    NOT NULL,
      url        TEXT    NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT    NOT NULL,
      token      TEXT    UNIQUE NOT NULL,
      expires_at TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  saveDB();
}

// Wrapper para compatibilidad con sql.js
class DatabaseWrapper {
  prepare(sql) {
    const self = this;
    return {
      run: (...params) => self.run(sql, params),
      get: (...params) => self.get(sql, params),
      all: (...params) => self.all(sql, params),
    };
  }

  run(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    try {
      db.run(sql, params);
      saveDB();
      return { changes: db.getRowsModified() };
    } catch (err) {
      console.error('DB Error:', err);
      throw err;
    }
  }

  get(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      let row = undefined;
      if (stmt.step()) {
        row = stmt.getAsObject();
      }
      stmt.free();
      return row;
    } catch (err) {
      console.error('DB Error:', err);
      throw err;
    }
  }

  all(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } catch (err) {
      console.error('DB Error:', err);
      throw err;
    }
  }

  exec(sql) {
    if (!db) throw new Error('Database not initialized');
    try {
      db.run(sql);
      saveDB();
    } catch (err) {
      console.error('DB Error:', err);
      throw err;
    }
  }

  pragma(pragma) {
    // sql.js no soporta pragmas, ignora silenciosamente
    return;
  }

  close() {
    if (db) {
      saveDB();
      db.close();
      db = null;
    }
  }
}

// Crear una instancia del wrapper
let dbWrapper = null;

async function initDBWrapper() {
  await initDB();
  dbWrapper = new DatabaseWrapper();
  return dbWrapper;
}

// Crear queries objeto con métodos
const queries = {
  // USERS
  findUserByEmail: {
    get: (email) => {
      if (!dbWrapper) throw new Error('DB not initialized');
      return dbWrapper.get(
        'SELECT * FROM users WHERE email = ? LIMIT 1',
        [email]
      );
    },
  },

  findUserById: {
    get: (id) => {
      if (!dbWrapper) throw new Error('DB not initialized');
      return dbWrapper.get(
        'SELECT id, email, name, role, created_at FROM users WHERE id = ? LIMIT 1',
        [id]
      );
    },
  },

  createUser: {
    run: (data) => {
      if (!dbWrapper) throw new Error('DB not initialized');
      return dbWrapper.run(
        'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)',
        [data.email, data.password, data.name, data.role]
      );
    },
  },

  userExists: {
    get: () => {
      if (!dbWrapper) throw new Error('DB not initialized');
      const result = dbWrapper.get('SELECT COUNT(*) as count FROM users');
      return result;
    },
  },

  // POSTS
  getAllPosts: {
    all: () => {
      if (!dbWrapper) throw new Error('DB not initialized');
      return dbWrapper.all(`
        SELECT p.*, u.name as author_name
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.published = 1
        ORDER BY p.created_at DESC
      `);
    },
  },

  getPostById: {
    get: (id) => {
      if (!dbWrapper) throw new Error('DB not initialized');
      return dbWrapper.get(
        'SELECT p.*, u.name as author_name FROM posts p JOIN users u ON p.author_id = u.id WHERE p.id = ? LIMIT 1',
        [id]
      );
    },
  },

   getPostImages: {
    all: (postId) => {
      if (!dbWrapper) throw new Error('DB not initialized');
      return dbWrapper.all(
        'SELECT * FROM post_images WHERE post_id = ? ORDER BY sort_order',
        [postId]
      );
    },
  },

  createPost: {
    run: (data) => {
      if (!dbWrapper) throw new Error('DB not initialized');
      const d = data;
      const result = dbWrapper.run(
        `INSERT INTO posts (title, content, excerpt, cover_image, video_url, tags, author_id, published)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [d.title, d.content, d.excerpt, d.cover_image, d.video_url, d.tags, d.author_id]
      );
      // Retornar ID del último insertado
      const lastPost = dbWrapper.get('SELECT id FROM posts ORDER BY id DESC LIMIT 1');
      return { lastInsertRowid: lastPost?.id };
    },
  },

  updatePost: {
    run: (data) => {
      if (!dbWrapper) throw new Error('DB not initialized');
      const d = data;
      return dbWrapper.run(
        `UPDATE posts 
         SET title = ?, content = ?, excerpt = ?, cover_image = ?, video_url = ?, tags = ?, updated_at = datetime('now')
         WHERE id = ? AND author_id = ?`,
        [d.title, d.content, d.excerpt, d.cover_image, d.video_url, d.tags, d.id, d.author_id]
      );
    },
  },

  deletePost: {
    run: (id, authorId) => {
      if (!dbWrapper) throw new Error('DB not initialized');
      return dbWrapper.run(
        'DELETE FROM posts WHERE id = ? AND author_id = ?',
        [id, authorId]
      );
    },
  },

  addImage: {
    run: (data) => {
      if (!dbWrapper) throw new Error('DB not initialized');
      const d = data;
      return dbWrapper.run(
        'INSERT INTO post_images (post_id, filename, url, sort_order) VALUES (?, ?, ?, ?)',
        [d.post_id, d.filename, d.url, d.sort_order]
      );
    },
  },

  deletePostImages: {
    run: (postId) => {
      if (!dbWrapper) throw new Error('DB not initialized');
      return dbWrapper.run(
        'DELETE FROM post_images WHERE post_id = ?',
        [postId]
      );
    },
  },

  getRecentPosts: {
    all: (limit) => {
      if (!dbWrapper) throw new Error('DB not initialized');
      return dbWrapper.all(
        'SELECT p.*, u.name as author_name FROM posts p JOIN users u ON p.author_id = u.id WHERE p.published = 1 ORDER BY p.created_at DESC LIMIT ?',
        [limit]
      );
    },
  },

  getPostsByTag: {
    all: (tag) => {
      if (!dbWrapper) throw new Error('DB not initialized');
      return dbWrapper.all(
        'SELECT p.*, u.name as author_name FROM posts p JOIN users u ON p.author_id = u.id WHERE p.published = 1 AND p.tags LIKE ? ORDER BY p.created_at DESC',
        [tag]
      );
    },
  },
};

// Helper functions para parsear posts
function parsePost(post) {
  if (!post) return null;
  return {
    ...post,
    tags: (() => { try { return JSON.parse(post.tags || '[]'); } catch { return []; } })(),
    images: post.images ? post.images.split(',').filter(Boolean) : [],
  };
}

function parsePostWithImages(post, images) {
  if (!post) return null;
  return {
    ...post,
    tags: (() => { try { return JSON.parse(post.tags || '[]'); } catch { return []; } })(),
    images: images ? images.map(i => i.url) : [],
  };
}

// Exportar función para inicializar y la BD wrapper
module.exports = {
  initDB,
  initDBWrapper,
  saveDB,
  getDB: () => db,
  DatabaseWrapper,
  queries,
  parsePost,
  parsePostWithImages,
};

