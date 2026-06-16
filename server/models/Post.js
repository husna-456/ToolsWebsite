const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    slug:           { type: String, required: true, unique: true, trim: true },
    title:          { type: String, required: true, trim: true },
    excerpt:        { type: String, default: '', maxlength: 300 },
    body:           { type: String, default: '' },
    coverImage:     { type: String, default: '' },
    category:       { type: String, default: '' },
    tags:           [{ type: String }],
    author:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status:         { type: String, enum: ['draft', 'published', 'scheduled'], default: 'draft' },
    publishDate:    { type: Date },
    featured:       { type: Boolean, default: false },
    seoTitle:       { type: String, default: '' },
    seoDescription: { type: String, default: '' },
    seoKeywords:    { type: String, default: '' },
    relatedTools:   [{ type: String }],
    views:          { type: Number, default: 0 },
  },
  { timestamps: true }
);

postSchema.index({ status: 1, publishDate: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ category: 1 });

module.exports = mongoose.model('Post', postSchema);
