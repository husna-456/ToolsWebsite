const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  source:    { type: String, default: 'usage-limit' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('EmailCapture', emailSchema);
