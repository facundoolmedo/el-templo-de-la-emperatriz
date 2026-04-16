<?php
// api/config.php

// Si existe un archivo .env en la raíz, se puede parsear,
// de lo contrario, se toman las de getenv() (útil para Docker y Hosting con variables pasadas)
function loadEnv($path) {
    if(!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);
        if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
            putenv(sprintf('%s=%s', $name, $value));
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
}
loadEnv(__DIR__ . '/../.env');

// Valores por defecto
$DB_HOST = getenv('DB_HOST') ?: 'localhost';
$DB_USER = getenv('DB_USER') ?: 'root';
$DB_PASS = getenv('DB_PASS') ?: '';
$DB_NAME = getenv('DB_NAME') ?: 'templo_db';

$JWT_SECRET = getenv('JWT_SECRET') ?: 'default_secret_please_change';
$JWT_EXPIRES_IN = 8 * 3600; // 8 horas
$JWT_REMEMBER_EXPIRES_IN = 30 * 24 * 3600; // 30 días
