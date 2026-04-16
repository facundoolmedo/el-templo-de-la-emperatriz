<?php
// api/contact.php
require_once __DIR__ . '/config.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/PHPMailer/Exception.php';
require __DIR__ . '/PHPMailer/PHPMailer.php';
require __DIR__ . '/PHPMailer/SMTP.php';

function handleContactRequest($method, $path, $body) {
    if ($method !== 'POST') {
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint no encontrado']);
        return;
    }

    $firstName = trim($body['firstName'] ?? '');
    $lastName = trim($body['lastName'] ?? '');
    $email = strtolower(trim($body['email'] ?? ''));
    $message = trim($body['message'] ?? '');

    if (!$firstName || !$email || !$message) {
        http_response_code(400);
        echo json_encode(['error' => 'Nombre, email y mensaje son obligatorios.']);
        return;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'Email inválido.']);
        return;
    }

    $recipient = trim(getenv('CONTACT_RECIPIENT_EMAIL'));
    $host = getenv('SMTP_HOST');
    $user = getenv('SMTP_USER');
    $pass = getenv('SMTP_PASS');
    $port = (int)getenv('SMTP_PORT');
    $secure = getenv('SMTP_SECURE');
    $from = getenv('SMTP_FROM') ?: $user;

    if (!$recipient || !$host || !$user || !$pass) {
        http_response_code(503);
        echo json_encode(['error' => 'Formulario de contacto deshabilitado temporalmente.']);
        return;
    }

    $fullName = trim("$firstName $lastName");
    $safeName = htmlspecialchars($fullName, ENT_QUOTES, 'UTF-8');
    $safeEmail = htmlspecialchars($email, ENT_QUOTES, 'UTF-8');
    $safeMessage = nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8'));

    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->Host       = $host;
        $mail->SMTPAuth   = true;
        $mail->Username   = $user;
        $mail->Password   = $pass;
        $mail->SMTPSecure = $secure === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : ($secure === 'tls' || $port == 587 ? PHPMailer::ENCRYPTION_STARTTLS : '');
        $mail->Port       = $port ?: 587;
        
        $mail->CharSet = 'UTF-8';
        $mail->setFrom($from, 'Sitio Web');
        $mail->addAddress($recipient);
        $mail->addReplyTo($email, $fullName);

        $mail->isHTML(true);
        $mail->Subject = "Nueva consulta web - $fullName";
        $mail->Body    = "
            <h2>Nueva consulta desde el sitio web</h2>
            <p><strong>Nombre:</strong> $safeName</p>
            <p><strong>Email:</strong> $safeEmail</p>
            <p><strong>Mensaje:</strong><br>$safeMessage</p>
        ";
        $mail->AltBody = "Nombre: $fullName\nEmail: $email\n\nMensaje:\n$message";

        $mail->send();
        echo json_encode(['message' => 'Consulta enviada correctamente.']);
    } catch (Exception $e) {
        error_log("Error enviando email: " . $mail->ErrorInfo);
        http_response_code(500);
        echo json_encode(['error' => 'No se pudo enviar la consulta.']);
    }
}
