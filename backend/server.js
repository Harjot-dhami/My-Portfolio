require('dotenv').config();

const express   = require('express');
const nodemailer = require('nodemailer');
const rateLimit  = require('express-rate-limit');
const helmet     = require('helmet');
const validator  = require('validator');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
//  SECURITY MIDDLEWARE
// ─────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false // disabled so your portfolio CSS/JS loads fine
}));
app.use(express.json({ limit: '10kb' }));

// ─────────────────────────────────────────────
//  RATE LIMITING  —  max 5 submissions per IP
//  per 15 minutes (stops spam bots)
// ─────────────────────────────────────────────
const contactLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Too many messages sent. Please wait 15 minutes and try again.'
  }
});

// ─────────────────────────────────────────────
//  SERVE YOUR PORTFOLIO (index.html + assets)
//  Put index.html one folder above this server
// ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..')));

// ─────────────────────────────────────────────
//  NODEMAILER  —  Gmail SMTP
// ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify connection on startup
transporter.verify((error) => {
  if (error) {
    console.error('❌ Email connection failed:', error.message);
    console.error('   → Check EMAIL_USER and EMAIL_PASS in your .env file');
  } else {
    console.log('✅ Email service connected and ready');
  }
});

// ─────────────────────────────────────────────
//  HELPER  —  sanitize input
// ─────────────────────────────────────────────
function clean(str) {
  if (typeof str !== 'string') return '';
  return validator.escape(str.trim()).slice(0, 3000);
}

// ─────────────────────────────────────────────
//  POST /api/contact
// ─────────────────────────────────────────────
app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { name, email, phone, business_type, message } = req.body;

    // ── VALIDATION ──────────────────────────
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Please enter your full name.' });
    }
    if (!email || !validator.isEmail(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
    if (!business_type || business_type.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Please enter your business type.' });
    }
    if (!message || message.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Message must be at least 10 characters.' });
    }

    // ── SANITIZE ────────────────────────────
    const data = {
      name:          clean(name),
      email:         validator.normalizeEmail(email.trim()),
      phone:         phone ? clean(phone) : 'Not provided',
      business_type: clean(business_type),
      message:       clean(message)
    };

    // ── EMAIL TO YOU (notification) ──────────
    await transporter.sendMail({
      from:    `"Portfolio Contact Form" <${process.env.EMAIL_USER}>`,
      to:      process.env.EMAIL_USER,
      replyTo: data.email,
      subject: `🔔 New Inquiry: ${data.name} — ${data.business_type}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f8; margin: 0; padding: 20px; }
    .wrapper { max-width: 580px; margin: auto; }
    .header {
      background: linear-gradient(135deg, #6C63FF, #4ECDC4);
      border-radius: 14px 14px 0 0;
      padding: 32px;
      text-align: center;
    }
    .header h1 { color: #fff; margin: 0; font-size: 1.4rem; letter-spacing: -0.3px; }
    .header p  { color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 0.88rem; }
    .body { background: #fff; padding: 32px; border-left: 1px solid #e8e8f0; border-right: 1px solid #e8e8f0; }
    .field { margin-bottom: 20px; }
    .field-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
                   letter-spacing: 1px; color: #9999b0; margin-bottom: 4px; }
    .field-value { font-size: 0.95rem; color: #222; line-height: 1.6; }
    .field-value a { color: #6C63FF; text-decoration: none; }
    .message-box { background: #f9f9ff; border-left: 3px solid #6C63FF;
                   border-radius: 0 8px 8px 0; padding: 16px 20px;
                   font-size: 0.92rem; color: #444; line-height: 1.7; white-space: pre-wrap; }
    .divider { border: none; border-top: 1px solid #f0f0f5; margin: 20px 0; }
    .reply-btn {
      display: inline-block; margin-top: 24px;
      background: linear-gradient(135deg, #6C63FF, #4ECDC4);
      color: #fff; text-decoration: none;
      padding: 12px 28px; border-radius: 8px;
      font-weight: 600; font-size: 0.9rem;
    }
    .footer { background: #f4f4f8; border-radius: 0 0 14px 14px;
              border: 1px solid #e8e8f0; border-top: none;
              padding: 16px 32px; text-align: center;
              font-size: 0.75rem; color: #aaa; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>📬 New Project Inquiry</h1>
      <p>Someone filled your portfolio contact form</p>
    </div>
    <div class="body">
      <div class="field">
        <div class="field-label">Name</div>
        <div class="field-value">${data.name}</div>
      </div>
      <hr class="divider">
      <div class="field">
        <div class="field-label">Email</div>
        <div class="field-value"><a href="mailto:${data.email}">${data.email}</a></div>
      </div>
      <hr class="divider">
      <div class="field">
        <div class="field-label">Phone</div>
        <div class="field-value">${data.phone}</div>
      </div>
      <hr class="divider">
      <div class="field">
        <div class="field-label">Business Type</div>
        <div class="field-value">${data.business_type}</div>
      </div>
      <hr class="divider">
      <div class="field">
        <div class="field-label">Message</div>
        <div class="message-box">${data.message}</div>
      </div>
      <a class="reply-btn" href="mailto:${data.email}">Reply to ${data.name} →</a>
    </div>
    <div class="footer">Sent from your portfolio at harjotdhami.dev@gmail.com</div>
  </div>
</body>
</html>
      `
    });

    // ── AUTO-REPLY TO VISITOR ────────────────
    await transporter.sendMail({
      from:    `"Harjot Dhami" <${process.env.EMAIL_USER}>`,
      to:      data.email,
      subject: `Got your message, ${data.name.split(' ')[0]}! I'll be in touch soon 👋`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f8; margin: 0; padding: 20px; }
    .wrapper { max-width: 580px; margin: auto; }
    .header {
      background: linear-gradient(135deg, #6C63FF, #4ECDC4);
      border-radius: 14px 14px 0 0;
      padding: 36px 32px;
      text-align: center;
    }
    .header h1 { color: #fff; margin: 0; font-size: 1.5rem; }
    .header p  { color: rgba(255,255,255,0.85); margin: 8px 0 0; }
    .body { background: #fff; padding: 36px 32px;
            border-left: 1px solid #e8e8f0; border-right: 1px solid #e8e8f0;
            font-size: 0.95rem; color: #333; line-height: 1.8; }
    .highlight { background: #f9f9ff; border-left: 3px solid #6C63FF;
                 border-radius: 0 8px 8px 0; padding: 14px 20px; margin: 20px 0;
                 font-size: 0.9rem; color: #555; white-space: pre-wrap; }
    .badge { display: inline-block; background: rgba(108,99,255,0.1);
             color: #6C63FF; border-radius: 100px; padding: 4px 14px;
             font-size: 0.8rem; font-weight: 600; margin-bottom: 20px; }
    .wa-btn {
      display: inline-block; margin-top: 8px;
      background: #25D366; color: #fff; text-decoration: none;
      padding: 12px 28px; border-radius: 8px;
      font-weight: 600; font-size: 0.9rem;
    }
    .footer { background: #f4f4f8; border-radius: 0 0 14px 14px;
              border: 1px solid #e8e8f0; border-top: none;
              padding: 20px 32px; text-align: center;
              font-size: 0.78rem; color: #aaa; }
    .footer a { color: #6C63FF; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Thanks for reaching out! 🙌</h1>
      <p>I received your message and I'll reply within 24 hours</p>
    </div>
    <div class="body">
      <span class="badge">✓ Message Received</span>
      <p>Hey <strong>${data.name.split(' ')[0]}</strong>,</p>
      <p>
        Thanks for contacting me through my portfolio. I've received your message
        and will get back to you personally within <strong>24 hours</strong>.
      </p>
      <p>Here's what you sent me:</p>
      <div class="highlight">${data.message}</div>
      <p>
        Need a faster reply? You can also reach me directly on WhatsApp:
      </p>
      <a class="wa-btn" href="https://wa.me/919530918489">
        💬 Chat on WhatsApp
      </a>
      <p style="margin-top: 32px;">
        Talk soon,<br>
        <strong>Harjot Dhami</strong><br>
        <span style="color:#888;font-size:0.88rem;">Web Developer — harjotdhami.dev@gmail.com</span>
      </p>
    </div>
    <div class="footer">
      You're receiving this because you filled the contact form at
      <a href="https://harjotdhami.netlify.app">harjotdhami.netlify.app</a>
    </div>
  </div>
</body>
</html>
      `
    });

    // ── SUCCESS ──────────────────────────────
    return res.status(200).json({
      success: true,
      message: 'Message sent successfully!'
    });

  } catch (err) {
    console.error('❌ Contact form error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please email me directly at harjotdhami.dev@gmail.com'
    });
  }
});

// ─────────────────────────────────────────────
//  HEALTH CHECK  (to confirm server is running)
// ─────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', message: 'Server is running ✅' });
});

// ─────────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Portfolio server running!');
  console.log(`   Local:  http://localhost:${PORT}`);
  console.log('');
});