const crypto   = require('crypto');
const UsageLog = require('../models/UsageLog');
const { FREE_LIMIT } = require('../constants/tools');

function hashIP(ip) {
  return crypto
    .createHash('sha256')
    .update(ip + (process.env.JWT_SECRET || 'fallback'))
    .digest('hex')
    .substring(0, 32);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

async function checkUsageLimit(req, res, next) {
  try {
    const rawIP  = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || '0.0.0.0';
    const ipHash = hashIP(rawIP);
    const slug   = req.params.slug;
    const date   = todayStr();

    const usage = await UsageLog.findOne({ ipHash, toolSlug: slug, date });
    const used  = usage ? usage.count : 0;

    // Limit enforcement disabled — unlimited usage
    // if (used >= FREE_LIMIT) { return res.status(429).json({...}); }

    // Attach for controller
    req.ipHash       = ipHash;
    req.usageDate    = date;
    req.currentUsage = used;
    next();
  } catch (err) {
    console.error('Usage middleware error:', err.message);
    next(); // Don't block user on error
  }
}

async function incrementUsage(ipHash, toolSlug, date, inputLength) {
  try {
    await UsageLog.findOneAndUpdate(
      { ipHash, toolSlug, date },
      { $inc: { count: 1 }, $set: { inputLength } },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('incrementUsage error:', err.message);
  }
}

module.exports = { checkUsageLimit, incrementUsage };
