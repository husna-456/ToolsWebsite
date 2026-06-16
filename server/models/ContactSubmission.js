const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true, maxlength: 100 },
    email:      { type: String, required: true, trim: true, lowercase: true },
    subject:    { type: String, required: true, trim: true, maxlength: 200 },
    message:    { type: String, required: true, trim: true, maxlength: 5000 },
    status:     { type: String, enum: ['new', 'read', 'replied', 'archived'], default: 'new' },
    ipAddress:  { type: String, default: '' },
    userAgent:  { type: String, default: '' },
    submittedAt:{ type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ContactSubmission', contactSchema);
