<?php
// api/posts.php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/jwt.php';

$UPLOADS_DIR = __DIR__ . '/../uploads';
if (!is_dir($UPLOADS_DIR)) mkdir($UPLOADS_DIR, 0777, true);

function optimizeImage($tmpFilePath, $originalName) {
    global $UPLOADS_DIR;
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'webp'];
    if (!in_array($ext, $allowed)) {
        // Si no es imagen soportada, mover tal cual
        $newName = time() . '-' . substr(md5(mt_rand()), 0, 8) . '.' . $ext;
        move_uploaded_file($tmpFilePath, $UPLOADS_DIR . '/' . $newName);
        return '/uploads/' . $newName;
    }

    $newName = time() . '-' . substr(md5(mt_rand()), 0, 8) . '.webp';
    $outPath = $UPLOADS_DIR . '/' . $newName;

    // Crear recurso GD
    $image = null;
    if ($ext === 'jpg' || $ext === 'jpeg') $image = @imagecreatefromjpeg($tmpFilePath);
    elseif ($ext === 'png') $image = @imagecreatefrompng($tmpFilePath);
    elseif ($ext === 'webp') $image = @imagecreatefromwebp($tmpFilePath);

    if (!$image) {
        $backupName = time() . '-' . substr(md5(mt_rand()), 0, 8) . '.' . $ext;
        move_uploaded_file($tmpFilePath, $UPLOADS_DIR . '/' . $backupName);
        return '/uploads/' . $backupName;
    }

    $width = imagesx($image);
    $height = imagesy($image);
    
    // Resize inside 1200x1200
    if ($width > 1200 || $height > 1200) {
        $ratio = min(1200 / $width, 1200 / $height);
        $newWidth = round($width * $ratio);
        $newHeight = round($height * $ratio);
        $newImage = imagecreatetruecolor($newWidth, $newHeight);
        
        // Preserve transparency for PNG
        if ($ext === 'png' || $ext === 'webp') {
            imagealphablending($newImage, false);
            imagesavealpha($newImage, true);
            $transparent = imagecolorallocatealpha($newImage, 255, 255, 255, 127);
            imagefilledrectangle($newImage, 0, 0, $newWidth, $newHeight, $transparent);
        }
        
        imagecopyresampled($newImage, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        imagedestroy($image);
        $image = $newImage;
    }

    imagewebp($image, $outPath, 82);
    imagedestroy($image);

    return '/uploads/' . $newName;
}

function handleVideoUpload($tmpFilePath, $originalName) {
    global $UPLOADS_DIR;
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $newName = time() . '-' . substr(md5(mt_rand()), 0, 8) . '.' . $ext;
    move_uploaded_file($tmpFilePath, $UPLOADS_DIR . '/' . $newName);
    return '/uploads/' . $newName;
}

function handlePostsRequest($method, $path, $body) {
    if ($method === 'GET') {
        if ($path === '' || $path === '/') {
            $tag = $_GET['tag'] ?? null;
            $limit = $_GET['limit'] ?? null;
            
            if ($tag && $tag !== 'todos') {
                $posts = Queries::getPostsByTag('%"' . $tag . '"%');
            } else if ($limit) {
                $posts = Queries::getRecentPosts($limit);
            } else {
                $posts = Queries::getAllPosts();
            }

            $parsed = array_map(function($p) {
                $images = Queries::getPostImages($p['id']);
                $p = parsePost($p);
                $p['images'] = array_map(function($i) { return $i['url']; }, $images);
                return $p;
            }, $posts);

            echo json_encode(['posts' => $parsed]);
            return;
        }

        // GET /:id
        if (preg_match('/^\/(\d+)$/', $path, $matches)) {
            $id = $matches[1];
            $post = Queries::getPostById($id);
            if (!$post) {
                http_response_code(404);
                echo json_encode(['error' => 'Post no encontrado.']);
                return;
            }
            $images = Queries::getPostImages($id);
            $post = parsePost($post);
            $post['images'] = array_map(function($i) { return $i['url']; }, $images);
            echo json_encode(['post' => $post]);
            return;
        }
    }

    if ($method === 'POST' && ($path === '' || $path === '/')) {
        $user = requireAuth();
        
        $title = $_POST['title'] ?? '';
        $content = $_POST['content'] ?? '';
        $video_url = $_POST['video_url'] ?? '';
        $tags = $_POST['tags'] ?? '[]';

        if (!trim($title) || !trim($content)) {
            http_response_code(400);
            echo json_encode(['error' => 'Título y contenido son obligatorios.']);
            return;
        }

        $plainText = substr(strip_tags($content), 0, 200);
        $excerpt = $plainText . (strlen(strip_tags($content)) >= 200 ? '...' : '');

        $cover_image = null;
        if (isset($_FILES['cover']) && $_FILES['cover']['error'] === UPLOAD_ERR_OK) {
            $cover_image = optimizeImage($_FILES['cover']['tmp_name'], $_FILES['cover']['name']);
        }

        $finalVideoUrl = $video_url ?: null;
        if (isset($_FILES['video']) && $_FILES['video']['error'] === UPLOAD_ERR_OK) {
            $finalVideoUrl = handleVideoUpload($_FILES['video']['tmp_name'], $_FILES['video']['name']);
        }

        $parsedTags = json_decode($tags);
        if (!is_array($parsedTags)) $parsedTags = [];

        $postId = Queries::createPost([
            'title' => trim($title),
            'content' => $content,
            'excerpt' => $excerpt,
            'cover_image' => $cover_image,
            'video_url' => $finalVideoUrl,
            'tags' => json_encode($parsedTags),
            'author_id' => $user['id']
        ]);

        if (isset($_FILES['images'])) {
            $total = is_array($_FILES['images']['name']) ? count($_FILES['images']['name']) : 0;
            for ($i = 0; $i < $total; $i++) {
                if ($_FILES['images']['error'][$i] === UPLOAD_ERR_OK) {
                    $url = optimizeImage($_FILES['images']['tmp_name'][$i], $_FILES['images']['name'][$i]);
                    Queries::addImage([
                        'post_id' => $postId,
                        'filename' => basename($url),
                        'url' => $url,
                        'sort_order' => $i
                    ]);
                }
            }
        }

        $post = parsePost(Queries::getPostById($postId));
        $images = Queries::getPostImages($postId);
        $post['images'] = array_map(function($img) { return $img['url']; }, $images);

        http_response_code(201);
        echo json_encode(['post' => $post]);
        return;
    }

    if ($method === 'PUT' && preg_match('/^\/(\d+)$/', $path, $matches)) {
        $user = requireAuth();
        $postId = $matches[1];
        
        $existing = Queries::getPostById($postId);
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Post no encontrado.']);
            return;
        }

        // php://input for PUT multipart/form-data doesn't populate $_FILES natively cleanly
        // In real environments, it's better to send POST requests with _method=PUT from frontend
        // But since we control the frontend, wait, how did the frontend send it?
        // Ah! In Express router.put, multer handles multipart form data perfectly. Native PHP does NOT parse multipart/form-data for PUT requests.
        // I will let the code handle it, but wait, I can simulate $_FILES by using $_POST directly if frontend sent POST? No, frontend sends PUT.
        // To fix this without touching frontend: we can parse raw input or accept POST with `?_method=PUT`
        // Actually, Express PUT multipart is standard in fetch. I will implement a workaround in api/index.php.
        // Assuming $_POST and $_FILES are populated (I'll do that in index.php)
        
        $title = $_POST['title'] ?? $existing['title'];
        $content = $_POST['content'] ?? $existing['content'];
        $video_url = $_POST['video_url'] ?? $existing['video_url'];
        $tags = $_POST['tags'] ?? $existing['tags'];

        $plainText = substr(strip_tags($content), 0, 200);
        $excerpt = $plainText . (strlen(strip_tags($content)) >= 200 ? '...' : '');

        $cover_image = $existing['cover_image'];
        if (isset($_FILES['cover']) && $_FILES['cover']['error'] === UPLOAD_ERR_OK) {
            $cover_image = optimizeImage($_FILES['cover']['tmp_name'], $_FILES['cover']['name']);
        }

        if (isset($_POST['delete_video']) && $_POST['delete_video'] === '1') {
            $finalVideoUrl = null;
        } else {
            $finalVideoUrl = $video_url ?: $existing['video_url'];
        }
        
        if (isset($_FILES['video']) && $_FILES['video']['error'] === UPLOAD_ERR_OK) {
            $finalVideoUrl = handleVideoUpload($_FILES['video']['tmp_name'], $_FILES['video']['name']);
        }

        $parsedTags = json_decode($tags);
        if (!is_array($parsedTags)) $parsedTags = [];

        Queries::updatePost([
            'id' => $postId,
            'title' => trim($title),
            'content' => $content,
            'excerpt' => $excerpt,
            'cover_image' => $cover_image,
            'video_url' => $finalVideoUrl,
            'tags' => json_encode($parsedTags),
            'author_id' => $user['id']
        ]);

        if (isset($_POST['delete_images']) && $_POST['delete_images'] === '1') {
            Queries::deletePostImages($postId);
        }

        if (isset($_FILES['images']) && is_array($_FILES['images']['name']) && count($_FILES['images']['name']) > 0 && $_FILES['images']['name'][0] != '') {
            Queries::deletePostImages($postId);
            $total = is_array($_FILES['images']['name']) ? count($_FILES['images']['name']) : 0;
            for ($i = 0; $i < $total; $i++) {
                if ($_FILES['images']['error'][$i] === UPLOAD_ERR_OK) {
                    $url = optimizeImage($_FILES['images']['tmp_name'][$i], $_FILES['images']['name'][$i]);
                    Queries::addImage([
                        'post_id' => $postId,
                        'filename' => basename($url),
                        'url' => $url,
                        'sort_order' => $i
                    ]);
                }
            }
        }

        $post = parsePost(Queries::getPostById($postId));
        $images = Queries::getPostImages($postId);
        $post['images'] = array_map(function($img) { return $img['url']; }, $images);
        echo json_encode(['post' => $post]);
        return;
    }

    if ($method === 'DELETE' && preg_match('/^\/(\d+)$/', $path, $matches)) {
        $user = requireAuth();
        $postId = $matches[1];
        
        $post = Queries::getPostById($postId);
        if (!$post) {
            http_response_code(404);
            echo json_encode(['error' => 'Post no encontrado.']);
            return;
        }

        global $UPLOADS_DIR;
        $images = Queries::getPostImages($postId);
        foreach ($images as $img) {
            $file = $UPLOADS_DIR . '/' . $img['filename'];
            if (file_exists($file)) unlink($file);
        }

        if ($post['cover_image']) {
            $coverFile = __DIR__ . '/..' . $post['cover_image'];
            if (file_exists($coverFile)) unlink($coverFile);
        }

        Queries::deletePostImages($postId);
        Queries::deletePost($postId, $user['id']);

        echo json_encode(['message' => 'Post eliminado.']);
        return;
    }

    http_response_code(404);
    echo json_encode(['error' => 'Endpoint no encontrado']);
}
