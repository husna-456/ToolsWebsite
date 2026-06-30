const mongoose = require('mongoose');

const adSlotSchema = {
  enabled: { type: Boolean, default: false },
  code:    { type: String, default: '' },
};

const settingSchema = new mongoose.Schema(
  {
    general: {
      siteName:          { type: String, default: 'Global Tech Tools' },
      siteDescription:   { type: String, default: '' },
      keywords:          { type: String, default: '' },
      footerAttribution: { type: String, default: '© Global Tech Tools. All Rights Reserved.' },
      logo:              { type: String, default: '' },
      contrastingLogo:   { type: String, default: '' },
      favicon:           { type: String, default: '' },
      ogImage:           { type: String, default: '' },
      links:             [{ label: String, url: String, position: { type: String, enum: ['header','footer','both'], default: 'footer' } }],
      googleAnalyticsId: { type: String, default: '' },
      customCss:         { type: String, default: '' },
      customHeaderTags:  { type: String, default: '' },
      customBodyTags:    { type: String, default: '' },
      customStylesheets: [{ type: String }],
      customScripts:     [{ type: String }],
    },

    smtp: {
      host:        { type: String, default: '' },
      port:        { type: Number, default: 587 },
      encryption:  { type: String, enum: ['none','tls','ssl'], default: 'tls' },
      username:    { type: String, default: '' },
      password:    { type: String, default: '' },
      fromName:    { type: String, default: 'Global Tech Tools' },
      fromEmail:   { type: String, default: '' },
      replyToEmail:{ type: String, default: '' },
      lastTestAt:  { type: Date },
    },

    ads: {
      enabled:          { type: Boolean, default: false },
      hideForPro:       { type: Boolean, default: true },
      provider:         { type: String, enum: ['adsense','custom','disabled'], default: 'disabled' },
      adsensePublisherId:{ type: String, default: '' },
      autoAds:          { type: Boolean, default: false },
      slots: {
        headerBanner:            { ...adSlotSchema },
        sidebarTop:              { ...adSlotSchema },
        sidebarBottom:           { ...adSlotSchema },
        belowToolHeader:         { ...adSlotSchema },
        belowToolInterface:      { ...adSlotSchema },
        betweenFaqAndRelated:    { ...adSlotSchema },
        footerBanner:            { ...adSlotSchema },
        mobileStickyBottom:      { ...adSlotSchema },
      },
    },

    saas: {
      enabled: { type: Boolean, default: false },
      pricing: {
        proMonthly:  { type: Number, default: 4.99 },
        proYearly:   { type: Number, default: 49.99 },
        teamMonthly: { type: Number, default: 14.99 },
        teamYearly:  { type: Number, default: 149.99 },
        trialDays:   { type: Number, default: 0 },
      },
      stripe: {
        publicKey:     { type: String, default: '' },
        secretKey:     { type: String, default: '' },
        webhookSecret: { type: String, default: '' },
        testMode:      { type: Boolean, default: true },
      },
      paypal: {
        clientId: { type: String, default: '' },
        secret:   { type: String, default: '' },
        mode:     { type: String, enum: ['sandbox','live'], default: 'sandbox' },
      },
      planFeatures: {
        free: [{ type: String }],
        pro:  [{ type: String }],
        team: [{ type: String }],
      },
    },

    toolPage: {
      showHeader:         { type: Boolean, default: true },
      showHowTo:          { type: Boolean, default: true },
      showFaq:            { type: Boolean, default: true },
      showRelated:        { type: Boolean, default: true },
      showCards:          { type: Boolean, default: true },
      showProBanner:      { type: Boolean, default: false },
      showComments:       { type: Boolean, default: false },
      maxWidth:           { type: String, default: '1200px' },
      showCategoryBadge:  { type: Boolean, default: true },
      showUsageCount:     { type: Boolean, default: false },
      showLastUpdated:    { type: Boolean, default: false },
      autoScrollToResult: { type: Boolean, default: true },
      loadingStyle:       { type: String, enum: ['spinner','dots','bar'], default: 'spinner' },
      defaultSortOrder:   { type: String, enum: ['popular','newest','alphabetical'], default: 'popular' },
      seoTitleTemplate:       { type: String, default: '{toolTitle} - Free Online Tool | {siteName}' },
      seoDescriptionTemplate: { type: String, default: '' },
    },

    security: {
      rateLimits: {
        tool:        { type: Number, default: 20 },
        auth:        { type: Number, default: 5 },
        contact:     { type: Number, default: 3 },
        fileProcess: { type: Number, default: 10 },
      },
      uploadLimits: {
        maxImage:           { type: Number, default: 10 },
        maxVideo:           { type: Number, default: 50 },
        maxAudio:           { type: Number, default: 20 },
        allowedImageMimes:  { type: [String], default: ['image/jpeg','image/png','image/webp','image/gif'] },
        allowedMediaMimes:  { type: [String], default: ['audio/*','video/*'] },
      },
      recaptcha: {
        enabled:   { type: Boolean, default: false },
        siteKey:   { type: String, default: '' },
        secretKey: { type: String, default: '' },
        thresholds: {
          auth:      { type: Number, default: 0.7 },
          contact:   { type: Number, default: 0.5 },
          tools:     { type: Number, default: 0.3 },
          subscribe: { type: Number, default: 0.5 },
        },
      },
      honeypot: {
        enabled:   { type: Boolean, default: true },
        fieldName: { type: String, default: 'website_url' },
      },
      botBlocking: {
        blockKnownBots: { type: Boolean, default: false },
        blockVpn:       { type: Boolean, default: false },
        ipWhitelist:    [{ type: String }],
        ipBlacklist:    [{ type: String }],
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
