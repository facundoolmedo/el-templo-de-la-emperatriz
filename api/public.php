<?php
// api/public.php
require_once __DIR__ . '/config.php';

function handlePublicRequest($method, $path) {
    if ($method === 'GET' && $path === '/config') {
        $phone = preg_replace('/\D/', '', getenv('WHATSAPP_PHONE'));
        $whatsappUrl = $phone ? "https://wa.me/{$phone}" : null;
        
        $hasSmtp = getenv('SMTP_HOST') && getenv('SMTP_USER') && getenv('SMTP_PASS');
        $hasRecipient = trim(getenv('CONTACT_RECIPIENT_EMAIL'));
        
        echo json_encode([
            'whatsappUrl' => $whatsappUrl,
            'whatsappEnabled' => (bool)$whatsappUrl,
            'contactEnabled' => (bool)($hasSmtp && $hasRecipient),
        ]);
        return;
    }

    http_response_code(404);
    echo json_encode(['error' => 'Endpoint no encontrado']);
}
