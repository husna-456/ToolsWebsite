const mongoose = require('mongoose');

const toolSchema = new mongoose.Schema(
  {
    // Identity
    slug:         { type: String, required: true, unique: true, trim: true },
    title:        { type: String, required: true, trim: true },
    shortDesc:    { type: String, required: true, maxlength: 120 },
    longDesc:     { type: String, maxlength: 500 },
    icon:         { type: String, default: 'Wrench' },
    toolType:     { type: String, default: '' },

    // Categorization
    category: {
      type: String,
      required: true,
      enum: ['ai-writing', 'text-tools', 'image-tools', 'media-tools', 'productivity', 'seo-tools'],
    },
    subcategory:  { type: String },
    tags:         [{ type: String }],

    // Status flags
    isActive:     { type: Boolean, default: true },
    isFree:       { type: Boolean, default: true },
    isPremium:    { type: Boolean, default: false },
    order:        { type: Number, default: 0 },

    // SEO
    seoTitle:       { type: String },
    seoDescription: { type: String },
    seoKeywords:    { type: String },

    // Tool page content
    howToUse:     [{ type: String }],
    faqs:         [{ question: { type: String }, answer: { type: String } }],
    relatedTools: [{ type: String }],
    whatItDoes:   { type: String },
    whoShouldUse: { type: String },
    whenToUse:    { type: String },

    // Slug history — old slugs kept for 301 redirects
    previousSlugs: [{ type: String }],

    // Runtime settings — editable from Admin → Web Tools Settings
    runtimeSettings: {
      maxFileSizeMb:    { type: Number },
      defaultQuality:   { type: Number },
      aiModel:          { type: String },
      rateLimitPerMin:  { type: Number },
      cacheTtlSeconds:  { type: Number },
      costPerUse:       { type: Number },
    },

    // Stats — never seeded, auto-updated by server
    usageCount:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tool', toolSchema);
