// routes/posts.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { queries, parsePost, parsePostWithImages } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ─── MULTER CONFIG ──────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|webm/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (allowed.test(ext)) cb(null, true);
  else cb(new Error('Tipo de archivo no permitido.'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB por archivo
});

// ─── Helper: optimizar imagen ────────────────────────────────────────
async function optimizeImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return filePath;

  const outPath = filePath.replace(ext, '.webp');
  try {
    await sharp(filePath)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outPath);
    fs.unlinkSync(filePath); // borrar original
    return outPath;
  } catch {
    return filePath; // si falla, usar original
  }
}

function fileUrl(filename) {
  return `/uploads/${path.basename(filename)}`;
}

// ─── GET /api/posts ─────────────────────────────────────────────────
// Listar todos los posts (público)
router.get('/', (req, res) => {
  try {
    const { tag, limit } = req.query;
    let posts;

    if (tag && tag !== 'todos') {
      posts = queries.getPostsByTag.all(`%"${tag}"%`);
    } else if (limit) {
      posts = queries.getRecentPosts.all(parseInt(limit) || 6);
    } else {
      posts = queries.getAllPosts.all();
    }

    const parsed = posts.map(p => {
      const images = queries.getPostImages.all(p.id);
      return parsePostWithImages(p, images);
    });

    res.json({ posts: parsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar los posts.' });
  }
});

// ─── GET /api/posts/:id ──────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const post = queries.getPostById.get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post no encontrado.' });

    const images = queries.getPostImages.all(post.id);
    res.json({ post: parsePostWithImages(post, images) });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar el post.' });
  }
});

// ─── POST /api/posts ─────────────────────────────────────────────────
// Crear post (solo admin)
router.post('/',
  requireAuth,
  upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'cover', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title, content, video_url, tags } = req.body;

      if (!title?.trim() || !content?.trim()) {
        return res.status(400).json({ error: 'Título y contenido son obligatorios.' });
      }

      // Generar excerpt (texto plano, primeros 200 chars)
      const plainText = content.replace(/<[^>]+>/g, '').substring(0, 200);
      const excerpt = plainText + (plainText.length >= 200 ? '...' : '');

      // Portada
      let cover_image = null;
      if (req.files?.cover?.[0]) {
        const optimized = await optimizeImage(req.files.cover[0].path);
        cover_image = fileUrl(optimized);
      }

      // Video subido
      let finalVideoUrl = video_url || null;
      if (req.files?.video?.[0]) {
        finalVideoUrl = fileUrl(req.files.video[0].path);
      }

      // Parsear tags
      let parsedTags = [];
      try { parsedTags = JSON.parse(tags || '[]'); } catch { parsedTags = []; }

      // Insertar post
      const result = queries.createPost.run({
        title: title.trim(),
        content,
        excerpt,
        cover_image,
        video_url: finalVideoUrl,
        tags: JSON.stringify(parsedTags),
        author_id: req.user.id,
      });

      const postId = result.lastInsertRowid;

      // Imágenes adicionales
      if (req.files?.images) {
        for (let i = 0; i < req.files.images.length; i++) {
          const optimized = await optimizeImage(req.files.images[i].path);
          queries.addImage.run({
            post_id: postId,
            filename: path.basename(optimized),
            url: fileUrl(optimized),
            sort_order: i,
          });
        }
      }

      const post = queries.getPostById.get(postId);
      const images = queries.getPostImages.all(postId);
      res.status(201).json({ post: parsePostWithImages(post, images) });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al crear el post.' });
    }
  }
);

// ─── PUT /api/posts/:id ──────────────────────────────────────────────
// Editar post (solo admin)
router.put('/:id',
  requireAuth,
  upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'cover', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title, content, video_url, tags, keep_images } = req.body;
      const postId = parseInt(req.params.id);

      const existing = queries.getPostById.get(postId);
      if (!existing) return res.status(404).json({ error: 'Post no encontrado.' });
      if (existing.author_id !== req.user.id) return res.status(403).json({ error: 'Sin permisos.' });

      const plainText = content.replace(/<[^>]+>/g, '').substring(0, 200);
      const excerpt = plainText + (plainText.length >= 200 ? '...' : '');

      let cover_image = existing.cover_image;
      if (req.files?.cover?.[0]) {
        const optimized = await optimizeImage(req.files.cover[0].path);
        cover_image = fileUrl(optimized);
      }

      let finalVideoUrl = video_url || existing.video_url;
      if (req.files?.video?.[0]) {
        finalVideoUrl = fileUrl(req.files.video[0].path);
      }

      let parsedTags = [];
      try { parsedTags = JSON.parse(tags || '[]'); } catch { parsedTags = []; }

      queries.updatePost.run({
        id: postId,
        title: title.trim(),
        content,
        excerpt,
        cover_image,
        video_url: finalVideoUrl,
        tags: JSON.stringify(parsedTags),
        author_id: req.user.id,
      });

      // Reemplazar imágenes si se subieron nuevas
      if (req.files?.images?.length) {
        queries.deletePostImages.run(postId);
        for (let i = 0; i < req.files.images.length; i++) {
          const optimized = await optimizeImage(req.files.images[i].path);
          queries.addImage.run({
            post_id: postId,
            filename: path.basename(optimized),
            url: fileUrl(optimized),
            sort_order: i,
          });
        }
      }

      const post = queries.getPostById.get(postId);
      const images = queries.getPostImages.all(postId);
      res.json({ post: parsePostWithImages(post, images) });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al actualizar el post.' });
    }
  }
);

// ─── DELETE /api/posts/:id ───────────────────────────────────────────
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const post = queries.getPostById.get(postId);

    if (!post) return res.status(404).json({ error: 'Post no encontrado.' });
    if (post.author_id !== req.user.id) return res.status(403).json({ error: 'Sin permisos.' });

    // Borrar imágenes del disco
    const images = queries.getPostImages.all(postId);
    images.forEach(img => {
      const filePath = path.join(UPLOADS_DIR, img.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    // Borrar portada
    if (post.cover_image) {
      const coverPath = path.join(__dirname, '..', 'public', post.cover_image);
      if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
    }

    queries.deletePostImages.run(postId);
    queries.deletePost.run(postId, req.user.id);

    res.json({ message: 'Post eliminado.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el post.' });
  }
});

module.exports = router;
