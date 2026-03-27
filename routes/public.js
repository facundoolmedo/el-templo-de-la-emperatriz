const express = require('express');

const router = express.Router();

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

router.get('/config', (req, res) => {
  const phone = normalizePhone(process.env.WHATSAPP_PHONE);
  const whatsappUrl = phone ? `https://wa.me/${phone}` : null;
  const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const hasRecipient = !!String(process.env.CONTACT_RECIPIENT_EMAIL || '').trim();

  res.json({
    whatsappUrl,
    whatsappEnabled: !!whatsappUrl,
    contactEnabled: hasSmtp && hasRecipient,
  });
});

module.exports = router;
