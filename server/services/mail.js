const nodemailer = require('nodemailer');

/**
 * Build a nodemailer transporter from stored SMTP settings.
 * encryption: 'ssl'  → secure:true  (port 465)
 * encryption: 'tls'  → STARTTLS required (port 587)
 * encryption: 'none' → plain, no upgrade
 */
function buildTransporter(smtp) {
  const isSSL  = smtp.encryption === 'ssl';
  const isTLS  = smtp.encryption === 'tls';
  const isNone = smtp.encryption === 'none';

  return nodemailer.createTransport({
    host:       smtp.host,
    port:       Number(smtp.port) || 587,
    secure:     isSSL,
    requireTLS: isTLS,
    ignoreTLS:  isNone,
    auth: {
      user: smtp.username,
      pass: smtp.password,
    },
    tls: {
      rejectUnauthorized: false, // tolerate self-signed / internal certs
    },
  });
}

/**
 * Send an email using the SMTP config object passed in.
 * replyTo overrides smtp.replyToEmail when provided (e.g. contact form notifications
 * where reply-to should be the form submitter, not the default support address).
 * Throws on connection or send failure so callers can surface the error.
 */
async function sendMail(smtp, { to, subject, html, text, replyTo }) {
  if (!smtp.host || !smtp.username || !smtp.password) {
    throw new Error('SMTP is not configured. Please fill in host, username, and password.');
  }

  const from = smtp.fromName
    ? `"${smtp.fromName}" <${smtp.fromEmail || smtp.username}>`
    : (smtp.fromEmail || smtp.username);

  const transporter = buildTransporter(smtp);

  const info = await transporter.sendMail({
    from,
    to,
    replyTo:  replyTo || smtp.replyToEmail || undefined,
    subject,
    text:     text || '',
    html:     html || '',
  });

  return info;
}

module.exports = { buildTransporter, sendMail };
