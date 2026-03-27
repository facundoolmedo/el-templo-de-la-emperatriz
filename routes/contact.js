const express = require('express');

const router = express.Router();

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTransportConfig() {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return {
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };
}

function isContactConfigured() {
  const recipient = String(process.env.CONTACT_RECIPIENT_EMAIL || '').trim();
  const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  return { enabled: !!recipient && hasSmtp, recipient };
}

router.post('/', async (req, res) => {
  const firstName = String(req.body.firstName || '').trim();
  const lastName = String(req.body.lastName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const message = String(req.body.message || '').trim();

  if (!firstName || !email || !message) {
    return res.status(400).json({ error: 'Nombre, email y mensaje son obligatorios.' });
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Email inválido.' });
  }

  const { enabled, recipient } = isContactConfigured();
  if (!enabled) return res.status(503).json({ error: 'Formulario de contacto deshabilitado temporalmente.' });

  const transportConfig = buildTransportConfig();
  if (!transportConfig.host || !transportConfig.auth.user || !transportConfig.auth.pass) {
    return res.status(503).json({ error: 'Formulario de contacto deshabilitado temporalmente.' });
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const safeName = escapeHtml(fullName);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

  const mailText = [
    'Nueva consulta desde el sitio web',
    '',
    `Nombre: ${fullName}`,
    `Email: ${email}`,
    '',
    'Mensaje:',
    message,
  ].join('\n');

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    return res.status(503).json({ error: 'Servicio de correo no disponible.' });
  }

  const transporter = nodemailer.createTransport(transportConfig);

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || transportConfig.auth.user,
      to: recipient,
      replyTo: email,
      subject: `Nueva consulta web - ${fullName}`,
      text: mailText,
      html: `
        <h2>Nueva consulta desde el sitio web</h2>
        <p><strong>Nombre:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Mensaje:</strong><br>${safeMessage}</p>
      `,
    });

    return res.json({ message: 'Consulta enviada correctamente.' });
  } catch (err) {
    console.error('Error enviando email de contacto:', err);
    return res.status(500).json({ error: 'No se pudo enviar la consulta.' });
  }
});

module.exports = router;
