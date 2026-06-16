const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema(
  {
    slug:           { type: String, required: true, unique: true, trim: true },
    title:          { type: String, required: true, trim: true },
    body:           { type: String, default: '' },
    seoTitle:       { type: String, default: '' },
    seoDescription: { type: String, default: '' },
    status:         { type: String, enum: ['draft', 'published'], default: 'published' },
    showInFooter:   { type: Boolean, default: false },
    showInNavbar:   { type: Boolean, default: false },
    order:          { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Page', pageSchema);
