const Page              = require('../models/Page');
const Post              = require('../models/Post');
const ContactSubmission = require('../models/ContactSubmission');
const Setting           = require('../models/Setting');
const { sendMail }      = require('../services/mail');

// Minimal HTML escaping for user-supplied content inside email HTML
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Fire-and-forget — saves to DB first, then sends both emails without blocking the response
async function sendContactEmails({ name, email, subject, message }) {
  const doc      = await Setting.findOne().lean();
  const smtp     = doc?.smtp;
  const siteName = doc?.general?.siteName || 'Global Tech Tools';

  // Skip silently if SMTP is not set up
  if (!smtp?.host || !smtp?.username || !smtp?.password) return;

  // Admin receives the submission — reply-to is the form submitter so a reply goes directly to them
  const adminTo = smtp.replyToEmail || smtp.fromEmail || smtp.username;

  const subjectLabel = esc(subject);
  const nameLabel    = esc(name);
  const emailLabel   = esc(email);
  const msgLabel     = esc(message).replace(/\n/g, '<br>');
  const now          = new Date().toLocaleString();

  await sendMail(smtp, {
    to:      adminTo,
    replyTo: email,
    subject: `[Contact] ${subject}`,
    text:    `New contact form submission\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}\n\nSubmitted: ${now}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#2563eb 0%,#3b82f6 100%);padding:24px 32px;">
          <h2 style="margin:0;color:#fff;font-size:18px;font-weight:700;">New Contact Form Submission</h2>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">${siteName}</p>
        </div>
        <div style="padding:32px;background:#fff;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;color:#0f172a;">
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:10px 0;color:#64748b;width:90px;vertical-align:top;">Name</td>
              <td style="padding:10px 0;font-weight:600;">${nameLabel}</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:10px 0;color:#64748b;vertical-align:top;">Email</td>
              <td style="padding:10px 0;"><a href="mailto:${emailLabel}" style="color:#2563eb;text-decoration:none;">${emailLabel}</a></td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:10px 0;color:#64748b;vertical-align:top;">Subject</td>
              <td style="padding:10px 0;">${subjectLabel}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#64748b;vertical-align:top;">Message</td>
              <td style="padding:10px 0;line-height:1.7;">${msgLabel}</td>
            </tr>
          </table>
        </div>
        <div style="padding:14px 32px;background:#f1f5f9;font-size:12px;color:#94a3b8;">
          Submitted ${now} &nbsp;·&nbsp; Reply to this email to respond directly to ${nameLabel}
        </div>
      </div>
    `,
  });

  // Confirmation back to the user who submitted
  await sendMail(smtp, {
    to:      email,
    subject: `We received your message — ${siteName}`,
    text:    `Hi ${name},\n\nThanks for reaching out! We've received your message and will get back to you within 24 hours.\n\nYour message:\n${message}\n\n— ${siteName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#2563eb 0%,#3b82f6 100%);padding:24px 32px;">
          <h2 style="margin:0;color:#fff;font-size:18px;font-weight:700;">Message Received ✓</h2>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">${siteName}</p>
        </div>
        <div style="padding:32px;background:#fff;">
          <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">Hi ${nameLabel},</p>
          <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.7;">
            Thanks for reaching out! We've received your message and will get back to you within 24 hours.
          </p>
          <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;border-left:4px solid #2563eb;">
            <p style="margin:0 0 6px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Your message</p>
            <p style="margin:0;font-size:14px;color:#334155;line-height:1.7;">${msgLabel}</p>
          </div>
        </div>
        <div style="padding:14px 32px;background:#f1f5f9;font-size:12px;color:#94a3b8;">
          ${esc(siteName)} &nbsp;·&nbsp; This is an automated confirmation — please do not reply to this email
        </div>
      </div>
    `,
  });
}

// ── Static Pages ──────────────────────────────────────────────────────────────

exports.getPublicPage = async (req, res) => {
  try {
    const page = await Page.findOne({ slug: req.params.slug, status: 'published' }).lean();
    if (!page) return res.status(404).json({ error: 'Page not found' });
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load page' });
  }
};

// ── Blog Posts ────────────────────────────────────────────────────────────────

exports.getPublicPosts = async (req, res) => {
  try {
    const { category, tag, page = 1, limit = 12 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = { status: 'published', publishDate: { $lte: new Date() } };
    if (category) filter.category = category;
    if (tag)      filter.tags     = tag;

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .select('slug title excerpt coverImage category tags publishDate author views')
        .populate('author', 'name avatar')
        .sort({ publishDate: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Post.countDocuments(filter),
    ]);

    res.json({ posts, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load posts' });
  }
};

exports.getPublicPost = async (req, res) => {
  try {
    const post = await Post.findOne({
      slug: req.params.slug,
      status: 'published',
      publishDate: { $lte: new Date() },
    })
      .populate('author', 'name avatar')
      .lean();

    if (!post) return res.status(404).json({ error: 'Post not found' });

    // Increment views (fire-and-forget)
    Post.updateOne({ _id: post._id }, { $inc: { views: 1 } }).catch(() => {});

    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load post' });
  }
};

// ── Contact Form ──────────────────────────────────────────────────────────────

exports.submitContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (name.length > 100 || subject.length > 200 || message.length > 5000) {
      return res.status(400).json({ error: 'Field length exceeded' });
    }

    const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const userAgent = req.headers['user-agent'] || '';

    await ContactSubmission.create({ name, email, subject, message, ipAddress, userAgent });

    // Send emails after DB save — errors are logged but never fail the user's request
    sendContactEmails({ name, email, subject, message }).catch(err => {
      console.error('[Contact] Email send failed:', err.message);
    });

    res.json({ success: true, message: "Your message has been received. We'll get back to you soon." });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// ── Public Settings ───────────────────────────────────────────────────────────

exports.getPublicSettings = async (req, res) => {
  try {
    const doc = await Setting.findOne().lean();
    if (!doc) return res.json({});

    // Only expose safe, public fields
    const { general, ads, saas, toolPage } = doc;
    res.json({
      general: {
        siteName:          general?.siteName,
        siteDescription:   general?.siteDescription,
        keywords:          general?.keywords,
        footerAttribution: general?.footerAttribution,
        logo:              general?.logo,
        contrastingLogo:   general?.contrastingLogo,
        favicon:           general?.favicon,
        ogImage:           general?.ogImage,
        links:             general?.links,
        googleAnalyticsId: general?.googleAnalyticsId,
        customCss:         general?.customCss,
        customHeaderTags:  general?.customHeaderTags,
        customBodyTags:    general?.customBodyTags,
        customStylesheets: general?.customStylesheets,
        customScripts:     general?.customScripts,
      },
      ads: {
        enabled:            ads?.enabled,
        provider:           ads?.provider,
        adsensePublisherId: ads?.adsensePublisherId,
        autoAds:            ads?.autoAds,
        slots:              ads?.slots,
      },
      saas: {
        enabled:      saas?.enabled,
        pricing:      saas?.pricing,
        planFeatures: saas?.planFeatures,
      },
      toolPage,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
};
