<?php
// api/auth.php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/jwt.php';

function handleAuthRequest($method, $path, $body) {
    if ($method === 'POST' && $path === '/login') {
        $email = trim(strtolower($body['email'] ?? ''));
        $password = $body['password'] ?? '';
        $remember = $body['remember'] ?? false;

        if (!$email || !$password) {
            http_response_code(400);
            echo json_encode(['error' => 'Email y contraseña requeridos.']);
            return;
        }

        $user = Queries::findUserByEmail($email);
        if (!$user || !password_verify($password, $user['password'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Email o contraseña incorrectos.']);
            return;
        }

        global $JWT_EXPIRES_IN, $JWT_REMEMBER_EXPIRES_IN, $JWT_SECRET;
        
        $expiresIn = $remember ? $JWT_REMEMBER_EXPIRES_IN : $JWT_EXPIRES_IN;
        
        $payload = [
            'id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'exp' => time() + $expiresIn
        ];

        $token = JWT::encode($payload, $JWT_SECRET);

        echo json_encode([
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'name' => $user['name'],
                'role' => $user['role']
            ],
            'expiresIn' => $expiresIn
        ]);
        return;
    }

    if ($method === 'GET' && $path === '/me') {
        $user = requireAuth();
        echo json_encode(['user' => $user]);
        return;
    }

    if ($method === 'POST' && $path === '/logout') {
        requireAuth();
        echo json_encode(['message' => 'Sesión cerrada.']);
        return;
    }

    http_response_code(404);
    echo json_encode(['error' => 'Endpoint no encontrado']);
}
