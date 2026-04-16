<?php
// api/db.php
require_once __DIR__ . '/config.php';

try {
    $db = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Error de conexión a la base de datos."]);
    exit;
}

// Helper para parsear la magia de arrays
function parsePost($post) {
    if (!$post) return null;
    $tags = json_decode($post['tags'] ?? '[]');
    if (!is_array($tags)) $tags = [];
    $post['tags'] = $tags;
    return $post;
}

// Queries simulando el comportamiento del viejo database.js
class Queries {
    public static function findUserByEmail($email) {
        global $db;
        $stmt = $db->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        return $stmt->fetch();
    }

    public static function findUserById($id) {
        global $db;
        $stmt = $db->prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    public static function getAllPosts() {
        global $db;
        $stmt = $db->query("
            SELECT p.*, u.name as author_name 
            FROM posts p 
            JOIN users u ON p.author_id = u.id 
            WHERE p.published = 1 
            ORDER BY p.created_at DESC
        ");
        return $stmt->fetchAll();
    }

    public static function getPostById($id) {
        global $db;
        $stmt = $db->prepare("
            SELECT p.*, u.name as author_name 
            FROM posts p 
            JOIN users u ON p.author_id = u.id 
            WHERE p.id = ? LIMIT 1
        ");
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    public static function getPostImages($postId) {
        global $db;
        $stmt = $db->prepare('SELECT * FROM post_images WHERE post_id = ? ORDER BY sort_order ASC');
        $stmt->execute([$postId]);
        return $stmt->fetchAll();
    }

    public static function createPost($data) {
        global $db;
        $stmt = $db->prepare("
            INSERT INTO posts (title, content, excerpt, cover_image, video_url, tags, author_id, published) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ");
        $stmt->execute([
            $data['title'],
            $data['content'],
            $data['excerpt'],
            $data['cover_image'],
            $data['video_url'],
            $data['tags'],
            $data['author_id']
        ]);
        return $db->lastInsertId();
    }

    public static function updatePost($data) {
        global $db;
        $stmt = $db->prepare("
            UPDATE posts 
            SET title = ?, content = ?, excerpt = ?, cover_image = ?, video_url = ?, tags = ? 
            WHERE id = ? AND author_id = ?
        ");
        $stmt->execute([
            $data['title'],
            $data['content'],
            $data['excerpt'],
            $data['cover_image'],
            $data['video_url'],
            $data['tags'],
            $data['id'],
            $data['author_id']
        ]);
    }

    public static function deletePost($id, $authorId) {
        global $db;
        $stmt = $db->prepare('DELETE FROM posts WHERE id = ? AND author_id = ?');
        $stmt->execute([$id, $authorId]);
    }

    public static function addImage($data) {
        global $db;
        $stmt = $db->prepare('INSERT INTO post_images (post_id, filename, url, sort_order) VALUES (?, ?, ?, ?)');
        $stmt->execute([
            $data['post_id'],
            $data['filename'],
            $data['url'],
            $data['sort_order']
        ]);
    }

    public static function deletePostImages($postId) {
        global $db;
        $stmt = $db->prepare('DELETE FROM post_images WHERE post_id = ?');
        $stmt->execute([$postId]);
    }

    public static function getRecentPosts($limit) {
        global $db;
        $stmt = $db->prepare("
            SELECT p.*, u.name as author_name 
            FROM posts p 
            JOIN users u ON p.author_id = u.id 
            WHERE p.published = 1 
            ORDER BY p.created_at DESC LIMIT ?
        ");
        // PDO bindParam is needed for LIMIT in emulated prepares, but try direct execute with int cast if needed. 
        // Emulation is set to false, so execute([$limit]) might work, but let's bind explicitly.
        $stmt->bindValue(1, (int)$limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function getPostsByTag($tagLike) {
        global $db;
        $stmt = $db->prepare("
            SELECT p.*, u.name as author_name 
            FROM posts p 
            JOIN users u ON p.author_id = u.id 
            WHERE p.published = 1 AND p.tags LIKE ? 
            ORDER BY p.created_at DESC
        ");
        $stmt->execute([$tagLike]);
        return $stmt->fetchAll();
    }

    public static function createAdmin($email, $password) {
        global $db;
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $db->prepare("
            INSERT INTO users (email, password, name, role) 
            VALUES (?, ?, 'La Emperatriz', 'admin')
            ON DUPLICATE KEY UPDATE password = ?
        ");
        $stmt->execute([$email, $hash, $hash]);
    }
}
