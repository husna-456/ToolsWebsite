const mongoose          = require('mongoose');
const Tool              = require('../models/Tool');
const User              = require('../models/User');
const UsageLog          = require('../models/UsageLog');
const Page              = require('../models/Page');
const Post              = require('../models/Post');
const ContactSubmission = require('../models/ContactSubmission');
const EmailCapture      = require('../models/EmailCapture');
const Setting           = require('../models/Setting');

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ── GET /api/admin/stats ──────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const today = todayStr();

    const [
      totalUsers,
      activeTools,
      todayResult,
      allTimeResult,
      topTools,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),
      Tool.countDocuments({ isActive: true }),
      UsageLog.aggregate([
        { $match: { date: today } },
        { $group: { _id: null, total: { $sum: '$count' } } },
      ]),
      Tool.aggregate([
        { $group: { _id: null, total: { $sum: '$usageCount' } } },
      ]),
      Tool.find()
        .sort({ usageCount: -1 })
        .limit(10)
        .select('slug title category usageCount isActive')
        .lean(),
      User.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('-password')
        .lean(),
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeTools,
        todayUses:   todayResult[0]?.total   || 0,
        allTimeUses: allTimeResult[0]?.total  || 0,
      },
      topTools,
      recentUsers,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/tools ──────────────────────────────────────
const getAdminTools = async (req, res, next) => {
  try {
    const tools = await Tool.find()
      .sort({ category: 1, order: 1 })
      .select('-__v')
      .lean();

    res.json({ success: true, tools, total: tools.length });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/admin/tools/:id ──────────────────────────────────
const updateTool = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id))
      return res.status(400).json({ success: false, error: 'Invalid tool ID.' });

    // Strip fields that must never be edited via admin panel
    const { slug, usageCount, createdAt, updatedAt, _id, __v, ...updates } = req.body;

    const tool = await Tool.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true, select: '-__v' }
    ).lean();

    if (!tool)
      return res.status(404).json({ success: false, error: 'Tool not found.' });

    res.json({ success: true, tool });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/tools/:id/toggle ────────────────────────
const toggleTool = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id))
      return res.status(400).json({ success: false, error: 'Invalid tool ID.' });

    const tool = await Tool.findById(id);
    if (!tool)
      return res.status(404).json({ success: false, error: 'Tool not found.' });

    tool.isActive = !tool.isActive;
    await tool.save();

    res.json({ success: true, slug: tool.slug, isActive: tool.isActive });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/users ──────────────────────────────────────
const getUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .select('-password')
      .lean();

    res.json({ success: true, users, total: users.length });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/users/:id/ban ───────────────────────────
const toggleBan = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id))
      return res.status(400).json({ success: false, error: 'Invalid user ID.' });

    const user = await User.findById(id).select('-password');
    if (!user)
      return res.status(404).json({ success: false, error: 'User not found.' });

    if (user.role === 'admin')
      return res.status(403).json({ success: false, error: 'Cannot ban an admin account.' });

    user.isBanned = !user.isBanned;
    await user.save();

    res.json({ success: true, userId: user._id, isBanned: user.isBanned });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/tools/export ──────────────────────────────
const exportTools = async (req, res, next) => {
  try {
    const tools = await Tool.find().select('-__v').lean();
    res.setHeader('Content-Disposition', 'attachment; filename="tools-backup.json"');
    res.json({ exported: new Date(), total: tools.length, tools });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/admin/tools/import ─────────────────────────────
const importTools = async (req, res, next) => {
  try {
    const { tools } = req.body;
    if (!Array.isArray(tools) || tools.length === 0)
      return res.status(400).json({ success: false, error: 'tools array required.' });

    let updated = 0, created = 0;
    for (const t of tools) {
      const { _id, __v, createdAt, updatedAt, ...data } = t;
      await Tool.findOneAndUpdate({ slug: data.slug }, { $set: data }, { upsert: true });
      const exists = await Tool.exists({ slug: data.slug });
      exists ? updated++ : created++;
    }
    res.json({ success: true, updated, created });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/tools/:id/slug ──────────────────────────
const changeSlug = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { slug: newSlug } = req.body;
    if (!isValidId(id))
      return res.status(400).json({ success: false, error: 'Invalid tool ID.' });
    if (!newSlug || !/^[a-z0-9-]+$/.test(newSlug))
      return res.status(400).json({ success: false, error: 'Slug must be lowercase letters, numbers, and hyphens only.' });

    const conflict = await Tool.findOne({ slug: newSlug });
    if (conflict && conflict._id.toString() !== id)
      return res.status(409).json({ success: false, error: 'Slug already in use by another tool.' });

    const tool = await Tool.findById(id);
    if (!tool) return res.status(404).json({ success: false, error: 'Tool not found.' });

    if (tool.slug !== newSlug) {
      // Save old slug for 301 redirect
      if (!tool.previousSlugs.includes(tool.slug)) tool.previousSlugs.push(tool.slug);
      tool.slug = newSlug;
      await tool.save();
    }
    res.json({ success: true, slug: tool.slug, previousSlugs: tool.previousSlugs });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/users/stats/usage ─────────────────────────
const getUsageChart = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    const rows = await UsageLog.aggregate([
      { $match: { date: { $gte: sinceStr } } },
      { $group: { _id: '$date', total: { $sum: '$count' } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, chart: rows.map(r => ({ date: r._id, count: r.total })) });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/users/:id ──────────────────────────────────
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id))
      return res.status(400).json({ success: false, error: 'Invalid user ID.' });

    const user = await User.findById(id).select('-password').lean();
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    const usageHistory = await UsageLog.find({ userId: id })
      .sort({ createdAt: -1 }).limit(50).lean();

    res.json({ success: true, user, usageHistory });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/admin/users ─────────────────────────────────────
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role = 'user' } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: 'name, email, and password are required.' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists)
      return res.status(409).json({ success: false, error: 'Email already in use.' });

    const user = await User.create({ name, email, password, role });
    res.status(201).json({ success: true, user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/users/:id ────────────────────────────────
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id))
      return res.status(400).json({ success: false, error: 'Invalid user ID.' });

    const allowed = ['name', 'role', 'plan', 'isBanned'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );

    const user = await User.findByIdAndUpdate(id, { $set: updates }, { new: true, select: '-password' }).lean();
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/admin/users/:id ───────────────────────────────
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id))
      return res.status(400).json({ success: false, error: 'Invalid user ID.' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
    if (user.role === 'admin')
      return res.status(403).json({ success: false, error: 'Cannot delete an admin account.' });

    await User.findByIdAndDelete(id);
    res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════════════════════════

const getPages = async (req, res, next) => {
  try {
    const pages = await Page.find().sort({ order: 1, createdAt: -1 }).lean();
    res.json({ success: true, pages });
  } catch (err) { next(err); }
};

const getPage = async (req, res, next) => {
  try {
    const page = await Page.findOne({ slug: req.params.slug }).lean();
    if (!page) return res.status(404).json({ success: false, error: 'Page not found.' });
    res.json({ success: true, page });
  } catch (err) { next(err); }
};

const createPage = async (req, res, next) => {
  try {
    const { slug, title } = req.body;
    if (!slug || !title) return res.status(400).json({ success: false, error: 'slug and title are required.' });
    if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ success: false, error: 'Invalid slug format.' });
    const page = await Page.create(req.body);
    res.status(201).json({ success: true, page });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, error: 'Slug already in use.' });
    next(err);
  }
};

const updatePage = async (req, res, next) => {
  try {
    const { slug: _s, ...updates } = req.body;
    const page = await Page.findOneAndUpdate(
      { slug: req.params.slug }, { $set: updates }, { new: true }
    ).lean();
    if (!page) return res.status(404).json({ success: false, error: 'Page not found.' });
    res.json({ success: true, page });
  } catch (err) { next(err); }
};

const deletePage = async (req, res, next) => {
  try {
    const page = await Page.findOneAndDelete({ slug: req.params.slug });
    if (!page) return res.status(404).json({ success: false, error: 'Page not found.' });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// POSTS (Blog)
// ═══════════════════════════════════════════════════════════════

const getPosts = async (req, res, next) => {
  try {
    const { status, category, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status)   filter.status   = status;
    if (category) filter.category = category;
    if (search)   filter.title    = { $regex: search, $options: 'i' };

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip).limit(parseInt(limit))
      .select('-body')
      .lean();

    res.json({ success: true, posts, total, page: parseInt(page) });
  } catch (err) { next(err); }
};

const getPostById = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'name email').lean();
    if (!post) return res.status(404).json({ success: false, error: 'Post not found.' });
    res.json({ success: true, post });
  } catch (err) { next(err); }
};

const createPost = async (req, res, next) => {
  try {
    const post = await Post.create({ ...req.body, author: req.user._id });
    res.status(201).json({ success: true, post });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, error: 'Slug already in use.' });
    next(err);
  }
};

const updatePost = async (req, res, next) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id, { $set: req.body }, { new: true }
    ).lean();
    if (!post) return res.status(404).json({ success: false, error: 'Post not found.' });
    res.json({ success: true, post });
  } catch (err) { next(err); }
};

const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ success: false, error: 'Post not found.' });
    res.json({ success: true });
  } catch (err) { next(err); }
};

const togglePublish = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, error: 'Post not found.' });
    post.status = post.status === 'published' ? 'draft' : 'published';
    if (post.status === 'published' && !post.publishDate) post.publishDate = new Date();
    await post.save();
    res.json({ success: true, status: post.status });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// CONTACT SUBMISSIONS
// ═══════════════════════════════════════════════════════════════

const getContacts = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 25 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.$or = [
      { email: { $regex: search, $options: 'i' } },
      { name:  { $regex: search, $options: 'i' } },
    ];
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await ContactSubmission.countDocuments(filter);
    const items = await ContactSubmission.find(filter)
      .sort({ submittedAt: -1 }).skip(skip).limit(parseInt(limit)).lean();
    res.json({ success: true, contacts: items, total });
  } catch (err) { next(err); }
};

const updateContact = async (req, res, next) => {
  try {
    const { status } = req.body;
    const contact = await ContactSubmission.findByIdAndUpdate(
      req.params.id, { $set: { status } }, { new: true }
    ).lean();
    if (!contact) return res.status(404).json({ success: false, error: 'Submission not found.' });
    res.json({ success: true, contact });
  } catch (err) { next(err); }
};

const deleteContact = async (req, res, next) => {
  try {
    const item = await ContactSubmission.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Submission not found.' });
    res.json({ success: true });
  } catch (err) { next(err); }
};

const getContactById = async (req, res, next) => {
  try {
    const contact = await ContactSubmission.findById(req.params.id).lean();
    if (!contact) return res.status(404).json({ success: false, error: 'Submission not found.' });
    res.json({ success: true, contact });
  } catch (err) { next(err); }
};

// ── POST /api/admin/contact/:id/ai-reply ─────────────────────
const aiReplyContact = async (req, res, next) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(400).json({ success: false, error: 'GROQ_API_KEY is not set in environment variables.' });
    }

    const contact = await ContactSubmission.findById(req.params.id).lean();
    if (!contact) return res.status(404).json({ success: false, error: 'Submission not found.' });

    const setting  = await getSetting();
    const siteName = setting?.general?.siteName || 'Global Tech Tools';

    const Groq      = require('groq-sdk');
    const groq      = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const firstName = contact.name.split(' ')[0];

    const response = await groq.chat.completions.create({
      model:       'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens:  600,
      messages: [
        {
          role:    'system',
          content: `You are a helpful, friendly support representative for ${siteName}, a free online web tools platform. Write professional, warm, concise email replies. Return ONLY the plain email body — no subject line, no headers, no preamble.`,
        },
        {
          role:    'user',
          content: `Write a reply to this contact form message.

Name: ${contact.name}
Subject: ${contact.subject}
Message:
${contact.message}

Rules:
- Address the user as "${firstName}"
- Be concise (2-4 short paragraphs)
- Directly address their question, request, or feedback
- End with an offer to help further
- Sign off as "${siteName} Support"`,
        },
      ],
    });

    const reply = response.choices[0]?.message?.content?.trim();
    if (!reply) return res.status(500).json({ success: false, error: 'AI returned an empty response.' });

    res.json({ success: true, reply });
  } catch (err) { next(err); }
};

// ── POST /api/admin/contact/:id/send-reply ───────────────────
const sendReplyContact = async (req, res, next) => {
  try {
    const contact = await ContactSubmission.findById(req.params.id).lean();
    if (!contact) return res.status(404).json({ success: false, error: 'Submission not found.' });

    const { replyBody } = req.body;
    if (!replyBody?.trim()) {
      return res.status(400).json({ success: false, error: 'Reply body is required.' });
    }

    const setting  = await getSetting();
    const smtp     = setting?.smtp;
    const siteName = setting?.general?.siteName || 'Global Tech Tools';

    if (!smtp?.host || !smtp?.username || !smtp?.password) {
      return res.status(400).json({ success: false, error: 'SMTP is not configured. Please set up SMTP in settings first.' });
    }

    const { sendMail } = require('../services/mail');

    const htmlBody = replyBody
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    await sendMail(smtp, {
      to:      contact.email,
      subject: `Re: ${contact.subject}`,
      text:    replyBody,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <div style="font-size:15px;color:#0f172a;line-height:1.8;">${htmlBody}</div>
          <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
            ${siteName}
          </div>
        </div>
      `,
    });

    await ContactSubmission.findByIdAndUpdate(req.params.id, { status: 'replied' });

    res.json({ success: true, message: `Reply sent to ${contact.email}.` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message || 'Failed to send reply.' });
  }
};

// ═══════════════════════════════════════════════════════════════
// SUBSCRIBERS (EmailCapture)
// ═══════════════════════════════════════════════════════════════

const getSubscribers = async (req, res, next) => {
  try {
    const { search, source, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (source) filter.source = source;
    if (search) filter.email = { $regex: search, $options: 'i' };
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await EmailCapture.countDocuments(filter);
    const items = await EmailCapture.find(filter)
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean();
    res.json({ success: true, subscribers: items, total });
  } catch (err) { next(err); }
};

const exportSubscribers = async (req, res, next) => {
  try {
    const subs = await EmailCapture.find().sort({ createdAt: -1 }).lean();
    const csv  = ['email,source,date', ...subs.map(s =>
      `${s.email},${s.source || ''},${s.createdAt?.toISOString() || ''}`
    )].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="subscribers.csv"');
    res.send(csv);
  } catch (err) { next(err); }
};

const deleteSubscriber = async (req, res, next) => {
  try {
    const item = await EmailCapture.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Subscriber not found.' });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════

async function getSetting() {
  let setting = await Setting.findOne();
  if (!setting) setting = await Setting.create({});
  return setting;
}

const getAllSettings = async (req, res, next) => {
  try {
    const s = await getSetting();
    res.json({ success: true, settings: s });
  } catch (err) { next(err); }
};

function makeSettingUpdater(section) {
  return async (req, res, next) => {
    try {
      const s = await getSetting();
      Object.assign(s[section], req.body);
      s.markModified(section);
      await s.save();
      res.json({ success: true, [section]: s[section] });
    } catch (err) { next(err); }
  };
}

const updateGeneralSettings   = makeSettingUpdater('general');
const updateSmtpSettings      = makeSettingUpdater('smtp');
const updateAdsSettings       = makeSettingUpdater('ads');
const updateSaasSettings      = makeSettingUpdater('saas');
const updateToolPageSettings  = makeSettingUpdater('toolPage');
const updateSecuritySettings  = makeSettingUpdater('security');

// ── POST /api/admin/settings/smtp/test ────────────────────────
const testSmtpSettings = async (req, res, next) => {
  try {
    const s    = await getSetting();
    const smtp = s.smtp || {};

    if (!smtp.host || !smtp.username || !smtp.password) {
      return res.status(400).json({
        success: false,
        message: 'SMTP settings are incomplete. Please save host, username, and password first.',
      });
    }

    const to = (req.body.to || smtp.fromEmail || smtp.username || '').trim();
    if (!to) {
      return res.status(400).json({
        success: false,
        message: 'Recipient email is required. Provide a "to" address or set a From Email in settings.',
      });
    }

    const { sendMail } = require('../services/mail');

    // Verify the connection before sending so we surface config errors clearly
    const { buildTransporter } = require('../services/mail');
    const transporter = buildTransporter(smtp);
    await transporter.verify();

    await sendMail(smtp, {
      to,
      subject: 'Global Tech Tools — SMTP Test Email',
      text: 'This is a test email from Global Tech Tools.\n\nYour SMTP configuration is working correctly.',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:linear-gradient(135deg,#2563eb,#3b82f6);border-radius:50%;">
              <span style="font-size:24px;">✓</span>
            </div>
          </div>
          <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;text-align:center;">SMTP Test Successful</h2>
          <p style="margin:0 0 24px;color:#475569;font-size:14px;text-align:center;">Your Global Tech Tools email configuration is working correctly.</p>
          <table style="width:100%;background:#fff;border-radius:8px;border:1px solid #e2e8f0;border-collapse:collapse;font-size:13px;">
            <tr><td style="padding:10px 16px;color:#64748b;border-bottom:1px solid #f1f5f9;">Host</td><td style="padding:10px 16px;color:#0f172a;">${smtp.host}:${smtp.port}</td></tr>
            <tr><td style="padding:10px 16px;color:#64748b;border-bottom:1px solid #f1f5f9;">Encryption</td><td style="padding:10px 16px;color:#0f172a;">${smtp.encryption?.toUpperCase()}</td></tr>
            <tr><td style="padding:10px 16px;color:#64748b;">Sent at</td><td style="padding:10px 16px;color:#0f172a;">${new Date().toLocaleString()}</td></tr>
          </table>
        </div>
      `,
    });

    s.smtp.lastTestAt = new Date();
    s.markModified('smtp');
    await s.save();

    res.json({ success: true, message: `Test email sent to ${to}`, lastTestAt: s.smtp.lastTestAt });
  } catch (err) {
    // Return a readable message — never crash with 500 on SMTP errors
    res.status(400).json({ success: false, message: err.message || 'Failed to send test email.' });
  }
};

// ── Web Tools Settings (runtimeSettings per tool) ─────────────
const getWebToolsSettings = async (req, res, next) => {
  try {
    const tools = await Tool.find()
      .sort({ category: 1, order: 1 })
      .select('slug title shortDesc longDesc icon category isActive isPremium seoTitle seoDescription seoKeywords runtimeSettings')
      .lean();
    res.json({ success: true, tools });
  } catch (err) { next(err); }
};

const updateWebToolSettings = async (req, res, next) => {
  try {
    const { slug } = req.params;
    if (!/^[a-z0-9-]+$/.test(slug))
      return res.status(400).json({ success: false, error: 'Invalid slug.' });

    const ALLOWED_TOP = ['title', 'shortDesc', 'longDesc', 'icon', 'category', 'isActive', 'isPremium', 'seoTitle', 'seoDescription', 'seoKeywords'];
    const update = {};
    for (const key of ALLOWED_TOP) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (req.body.runtimeSettings && typeof req.body.runtimeSettings === 'object') {
      update.runtimeSettings = req.body.runtimeSettings;
    }

    const tool = await Tool.findOneAndUpdate(
      { slug },
      { $set: update },
      { new: true, select: 'slug title shortDesc longDesc icon category isActive isPremium seoTitle seoDescription seoKeywords runtimeSettings' }
    ).lean();
    if (!tool) return res.status(404).json({ success: false, error: 'Tool not found.' });
    res.json({ success: true, tool });
  } catch (err) { next(err); }
};

// ── Admin profile ─────────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password').lean();
    res.json({ success: true, user });
  } catch (err) { next(err); }
};

const updateProfile = async (req, res, next) => {
  try {
    const allowed = ['name', 'email'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, select: '-password' }).lean();
    res.json({ success: true, user });
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, error: 'currentPassword and newPassword required.' });
    const user = await User.findById(req.user._id);
    const ok   = await user.matchPassword(currentPassword);
    if (!ok) return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true });
  } catch (err) { next(err); }
};

module.exports = {
  // Stats
  getStats, getUsageChart,
  // Tools
  getAdminTools, updateTool, toggleTool, exportTools, importTools, changeSlug,
  // Users
  getUsers, toggleBan, getUserById, createUser, updateUser, deleteUser,
  // Pages
  getPages, getPage, createPage, updatePage, deletePage,
  // Posts
  getPosts, getPostById, createPost, updatePost, deletePost, togglePublish,
  // Contact
  getContacts, updateContact, deleteContact,
  getContactById, aiReplyContact, sendReplyContact,
  // Subscribers
  getSubscribers, exportSubscribers, deleteSubscriber,
  // Settings
  getAllSettings,
  updateGeneralSettings, updateSmtpSettings, testSmtpSettings, updateAdsSettings,
  updateSaasSettings, updateToolPageSettings, updateSecuritySettings,
  getWebToolsSettings, updateWebToolSettings,
  // Profile
  getProfile, updateProfile, changePassword,
};
