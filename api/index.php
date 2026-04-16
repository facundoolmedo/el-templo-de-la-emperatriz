<?php
// api/index.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Convert JSON body params to $_POST so it acts like Express body parsing
if ($_SERVER['REQUEST_METHOD'] === 'POST' || $_SERVER['REQUEST_METHOD'] === 'PUT') {
    $contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
    if (strpos($contentType, 'application/json') !== false) {
        $content = trim(file_get_contents("php://input"));
        $decoded = json_decode($content, true);
        if (is_array($decoded)) {
            $_POST = array_merge($_POST, $decoded);
        }
    }
}

// Workaround for PHP's lack of PUT multipart/form-data parsing
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['_method'])) {
    if (strtoupper($_POST['_method']) === 'PUT') {
        $_SERVER['REQUEST_METHOD'] = 'PUT';
    }
}

$request = $_GET['request'] ?? '';
$path = '/' . trim($request, '/');

// Logica de routing muy básica
if (strpos($path, '/auth') === 0) {
    require_once __DIR__ . '/auth.php';
    handleAuthRequest($_SERVER['REQUEST_METHOD'], substr($path, 5), $_POST);
} elseif (strpos($path, '/public') === 0) {
    require_once __DIR__ . '/public.php';
    handlePublicRequest($_SERVER['REQUEST_METHOD'], substr($path, 7));
} elseif (strpos($path, '/posts') === 0) {
    require_once __DIR__ . '/posts.php';
    handlePostsRequest($_SERVER['REQUEST_METHOD'], substr($path, 6), $_POST);
} elseif (strpos($path, '/contact') === 0) {
    require_once __DIR__ . '/contact.php';
    handleContactRequest($_SERVER['REQUEST_METHOD'], substr($path, 8), $_POST);
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Endpoint no encontrado']);
}
