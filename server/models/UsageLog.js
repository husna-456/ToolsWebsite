const mongoose = require('mongoose');

const usageLogSchema = new mongoose.Schema({
  ipHash:      { type: String, required: true },
  toolSlug:    { type: String, required: true },
  date:        { type: String, required: true },
  count:       { type: Number, default: 1 },
  inputLength: { type: Number },
  createdAt:   { type: Date, default: Date.now },
});

// One doc per ip + tool + day
usageLogSchema.index({ ipHash: 1, toolSlug: 1, date: 1 }, { unique: true });

// Auto-delete logs after 7 days
usageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

module.exports = mongoose.model('UsageLog', usageLogSchema);
