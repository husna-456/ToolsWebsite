# InnovateTools — Master Development Skill File

> **READ COMPLETELY BEFORE WRITING ANY CODE.**
> This file is the single source of truth. If anything elsewhere contradicts this file, this file wins.

---

## 0. PROJECT STATUS — WHERE WE ARE TODAY

**Stack:** MERN (MongoDB, Express, React, Node.js)
**AI:** Groq SDK (llama-3.3-70b-versatile) via `server/services/groq.js`
**Styling:** Tailwind CSS — purple/white scheme
**Auth:** JWT in localStorage
**Routing:** React Router v6

### Tools That Already Exist And Work — DO NOT TOUCH

These 10 tools are LIVE. Never modify their working logic in Phase 1:

```
1.  ai-humanizer
2.  ai-detector
3.  tone-changer
4.  plagiarism-checker
5.  word-counter
6.  summarizer
7.  speech-to-text
8.  jpg-to-word
9.  image-translator
10. pomodoro-timer
```

### Tools To REMOVE In Phase 1

```
❌ article-rewriter   → delete the page, delete the route, delete from DB seed
```

### Tools To FIX In Phase 1 (logic update, not rebuild)

```
🔧 citation-generator → add auto-fetch (Website/Book/Journal/Newspaper/Magazine/Report/Thesis)
🔧 text-to-image      → improve UI/UX to PixelLab-style flow
```

### Tools To BUILD NEW In Phase 1 (20 total)

**Image Tools (10):**
```
image-compressor, image-resizer, image-converter, image-cropper,
background-remover, image-to-grayscale, image-rotator,
image-watermark, image-to-base64, qr-code-generator
```

**Media Tools (10):**
```
audio-converter, video-converter, audio-compressor, video-compressor,
audio-trimmer, video-trimmer, audio-extractor, video-to-gif,
mute-video, change-video-speed
```

### Models That Already Exist
```
✅ server/models/UsageLog.js
✅ server/models/EmailCapture.js
✅ server/models/User.js   (assumed — needed for auth)
```

### Models To CREATE In Phase 1
```
🆕 server/models/Tool.js   (this is the big one — all tool metadata)
```

---

## 1. COLOR SCHEME — NEVER DEVIATE

Two separate palettes — one per area:

### Public Site (Navbar, Footer, Tool Pages, Blog, Auth)
```
Primary:        #7C3AED (violet-600)
Accent:         #6D28D9 (violet-700)
Background:     #FFFFFF (white)
Surface:        #F5F3FF (violet-50)
Surface-2:      #EDE9FE (violet-100)
Border:         #DDD6FE (violet-200)
Text Primary:   #1E1B4B (violet-950)
Text Secondary: #6B7280 (gray-500)
Text Muted:     #9CA3AF (gray-400)

Button:    bg-violet-600 hover:bg-violet-700 text-white
Card:      bg-white border border-violet-200 rounded-2xl
Surface:   bg-violet-50
```

### Admin Panel (/admin/*) — blue-500 scheme
```
Sidebar bg:      #3B82F6 (blue-500)
Sidebar text:    white (default white/75, active white)
Active nav item: bg-white/20 text-white font-medium
Hover nav item:  bg-white/10 text-white
Section labels:  text-white/45 text-xs uppercase tracking-widest
Topbar bg:       #FFFFFF (white) with border-b
Content bg:      #F9FAFB (gray-50)
Content cards:   bg-white border border-gray-200 rounded-xl
Accent:          blue-500 for buttons, badges, highlights
```

No mixing: violet stays on public pages, blue on admin pages.

No other colors. No gradients outside violet. No dark mode in Phase 1.

---

## 2. FOLDER STRUCTURE — STRICTLY FOLLOW

```
client/src/
  pages/
    tools/          ← one file per tool: ImageCompressorPage.jsx
    admin/          ← admin pages
    blog/           ← (Phase 2 only)
  components/
    tools/          ← ToolCard.jsx, ToolPageLayout.jsx, RelatedTools.jsx
    layout/         ← Navbar.jsx, Footer.jsx
    ui/             ← Button, Badge, Modal, Toggle
  hooks/
    useToolRun.js
    useFileUpload.js
  context/
    AuthContext.jsx
  layouts/
    AdminLayout.jsx

server/
  routes/
    tools.js        ← /api/tools/*
    admin.js        ← /api/admin/*
    auth.js         ← /api/auth/*
  controllers/
    toolController.js
    adminController.js
    authController.js
  models/
    Tool.js         ← NEW in Phase 1
    User.js
    UsageLog.js
    EmailCapture.js
  services/
    groq.js
    fileProcessor.js   ← NEW in Phase 1
  middleware/
    auth.js
    adminAuth.js       ← NEW in Phase 1
    rateLimiter.js
    upload.js          ← NEW in Phase 1
  jobs/
    cleanup.js         ← NEW in Phase 1 (cron job)
  seeds/
    tools.js           ← NEW — tool data array
  seedDB.js            ← NEW — the script that runs once
```

---

## 3. DATA APPROACH — SEEDDB (FINAL DECISION)

**Decision is locked: tools live in MongoDB.** No frontend `tools.js` data file.

### Why SeedDB?

```
Frontend tools.js              SeedDB (MongoDB)
─────────────────────          ─────────────────────
❌ Admin cannot edit            ✅ Admin panel edits any field
❌ Each change = git commit     ✅ Each change = button click
❌ Developer needed always      ✅ Non-tech admin can update SEO
❌ Stats cannot be tracked      ✅ usageCount auto-updates per tool
```

### How SeedDB Works (Simple Explanation)

```
node server/seedDB.js   ← run ONCE at project setup
        ↓
Reads server/seeds/tools.js (data array)
        ↓
Connects to MongoDB
        ↓
Deletes existing tools collection
        ↓
Inserts all 30 tools (10 existing + 20 new)
        ↓
Script exits — never run again
        ↓
From this point on, admin panel manages everything
```

### When To Re-run seedDB

```
✅ First time setup
✅ Fresh database / wipe and start over
✅ Adding a brand-new tool category in dev (rare)
❌ NEVER in production after launch
❌ NEVER to update content (use admin panel)
```

---

## 4. TOOL MODEL — `server/models/Tool.js`

This is the schema every tool follows. Admin panel can edit every field except `slug`, `usageCount`, `createdAt`.

```javascript
{
  // Identity
  slug: String,            // unique, kebab-case: 'image-compressor'
  title: String,           // 'Image Compressor'
  shortDesc: String,       // shown on card (max 120 chars)
  longDesc: String,        // shown on tool page (max 500 chars)
  icon: String,            // lucide icon name: 'ImageDown'

  // Categorization
  category: String,        // enum below
  subcategory: String,     // optional
  tags: [String],          // ['compress', 'optimize', 'jpg']

  // Status flags
  isActive: Boolean,       // admin can toggle off without delete
  isFree: Boolean,         // true = no login (Phase 1 = always true)
  isPremium: Boolean,      // Phase 2 feature — false for now
  order: Number,           // display order within category

  // SEO (managed from admin panel)
  seoTitle: String,
  seoDescription: String,
  seoKeywords: String,

  // Tool page content (managed from admin panel)
  howToUse: [String],      // ['Upload your image', 'Click compress', ...]
  faqs: [{ question: String, answer: String }],
  relatedTools: [String],  // slugs: ['image-resizer', 'image-converter']
  whatItDoes: String,      // "What This Tool Does" card
  whoShouldUse: String,    // "Who Should Use It" card
  whenToUse: String,       // "When To Use It" card

  // Stats (auto-updated by server, never seeded manually)
  usageCount: Number,

  createdAt: Date,
  updatedAt: Date
}
```

### Category Enum

```
'ai-writing'    → ai-humanizer, tone-changer, summarizer, citation-generator
'text-tools'    → word-counter, plagiarism-checker, ai-detector
'image-tools'   → all 10 image tools + jpg-to-word + image-translator + text-to-image
'media-tools'   → all 10 media tools + speech-to-text
'productivity'  → pomodoro-timer
'seo-tools'     → reserved for Phase 2
```

---

## 5. TOOL PAGE LAYOUT — EVERY TOOL HAS THESE 6 SECTIONS IN ORDER

```
1. Tool Header        ← icon + title + shortDesc + category badge
2. Tool Interface     ← the actual input/output UI (you write this)
3. How To Use         ← numbered steps from tool.howToUse
4. FAQ Accordion      ← from tool.faqs (expand/collapse)
5. Related Tools      ← 3 cards from tool.relatedTools (looked up by slug)
6. What/Who/When      ← 3 info cards from tool.whatItDoes/whoShouldUse/whenToUse
```

### The Pattern

```jsx
// client/src/pages/tools/ImageCompressorPage.jsx
import ToolPageLayout from '../../components/tools/ToolPageLayout';

export default function ImageCompressorPage() {
  // state for THIS tool only
  return (
    <ToolPageLayout slug="image-compressor">
      {/* You ONLY write the tool interface here (section 2) */}
      <div className="bg-white rounded-2xl border border-violet-200 p-6">
        {/* upload, slider, process button, before/after preview */}
      </div>
    </ToolPageLayout>
  );
}
```

`ToolPageLayout` does the rest:
- Fetches `GET /api/tools/:slug` on mount
- Renders header (section 1)
- Renders your `children` (section 2)
- Renders sections 3-6 from fetched data
- Shows skeleton while loading
- Shows 404 if tool not found OR `isActive: false`

---

## 6. BACKEND API CONTRACT

### AI Tools (text in → text out)
```
POST /api/tools/:slug/run
Body: { input: string, options?: object }
Auth: optional (track IP for rate limit)
Response: { result: string, fromCache: boolean }
Rate limit: 20/min per IP
```

### File Tools (file in → file out)
```
POST /api/tools/:slug/process
Body: multipart/form-data (field 'file' + option fields)
Auth: optional
Response: streamed file download OR { url: string, filename: string }
Rate limit: 10/min per IP
```

### Special: Citation Auto-Fetch (Phase 1 fix)
```
POST /api/tools/citation-generator/fetch-source
Body: { sourceType: string, url?: string, isbn?: string, doi?: string }
Response: { title, author, year, publisher, url, journal, volume, issue, pages, doi, isbn, newspaperName, magazineName }
On failure: { error: 'Could not fetch details. Please enter manually.' }
```

### Tool Listing
```
GET /api/tools                  → all active tools grouped by category
GET /api/tools/:slug            → single tool full data
```

### Admin Routes (require adminAuth)
```
# Dashboard
GET   /api/admin/stats              → dashboard counters + charts data
GET   /api/admin/stats/usage        → tool usage chart data (7/30/90 days)

# Tools
GET   /api/admin/tools              → all tools (including inactive)
PUT   /api/admin/tools/:id          → update any tool field
PATCH /api/admin/tools/:id/toggle   → flip isActive
PATCH /api/admin/tools/:id/slug     → change slug (saves old to previousSlugs)
GET   /api/admin/tools/export       → JSON backup of all tools
POST  /api/admin/tools/import       → restore from JSON backup

# Users
GET    /api/admin/users             → user list with filters/search
GET    /api/admin/users/:id         → single user + usage history
POST   /api/admin/users             → create user manually
PATCH  /api/admin/users/:id         → update role / plan / status
PATCH  /api/admin/users/:id/ban     → ban / unban
POST   /api/admin/users/:id/reset   → trigger password reset email
DELETE /api/admin/users/:id         → delete account (soft delete)

# Blog Posts
GET    /api/admin/posts             → list with filters
GET    /api/admin/posts/:id         → single post
POST   /api/admin/posts             → create post
PUT    /api/admin/posts/:id         → update post
DELETE /api/admin/posts/:id         → delete post
PATCH  /api/admin/posts/:id/publish → publish/unpublish
POST   /api/admin/posts/upload      → upload cover image

# Pages (static content)
GET    /api/admin/pages             → list all pages
GET    /api/admin/pages/:slug       → single page
POST   /api/admin/pages             → create new page
PUT    /api/admin/pages/:slug       → update page content
DELETE /api/admin/pages/:slug       → delete page

# Contact submissions
GET    /api/admin/contact           → all submissions
PATCH  /api/admin/contact/:id       → update status
DELETE /api/admin/contact/:id       → delete submission

# Subscribers (EmailCapture)
GET    /api/admin/subscribers       → list with pagination
GET    /api/admin/subscribers/export → CSV download
DELETE /api/admin/subscribers/:id   → remove subscriber

# Settings (one endpoint per section)
GET    /api/admin/settings              → all settings
PUT    /api/admin/settings/general      → update general section
PUT    /api/admin/settings/smtp         → update SMTP config
POST   /api/admin/settings/smtp/test    → send test email
PUT    /api/admin/settings/ads          → update ad slots + config
PUT    /api/admin/settings/saas         → update SaaS / pricing
POST   /api/admin/settings/saas/test-stripe → verify Stripe connection
POST   /api/admin/settings/saas/test-paypal → verify PayPal connection
PUT    /api/admin/settings/tool-page    → update tool page settings
PUT    /api/admin/settings/security     → update security config
POST   /api/admin/settings/security/test-recaptcha → verify reCAPTCHA

# Web Tools Settings (per-tool runtime config)
GET    /api/admin/web-tools-settings        → all tools grouped by category
PUT    /api/admin/web-tools-settings/:slug  → update tool's runtimeSettings

# Profile (admin's own)
GET    /api/admin/profile           → current admin profile
PUT    /api/admin/profile           → update profile
POST   /api/admin/profile/password  → change password
GET    /api/admin/profile/sessions  → list active sessions
DELETE /api/admin/profile/sessions  → log out all other sessions

# File uploads (logo, favicon, post images, etc.)
POST   /api/admin/upload            → multipart upload, returns URL
```

### Public Routes (additions for Phase 1 admin features)
```
POST  /api/contact                  → submit contact form (rate-limited + reCAPTCHA)
GET   /api/pages/:slug              → fetch published static page
GET   /api/posts                    → list published blog posts (paginated)
GET   /api/posts/:slug              → single blog post (increments views)
GET   /api/posts/category/:cat      → filter by category
GET   /api/posts/tag/:tag           → filter by tag
GET   /api/settings/public          → public site settings (name, logo, social, ad slots)
```

---

## 7. SHARED HOOKS

### `useToolRun.js` — AI tools
```javascript
const { run, result, loading, error } = useToolRun('ai-humanizer');
run({ input: 'text', options: { tone: 'casual' } });
```

### `useFileUpload.js` — Image/media tools
```javascript
const { upload, result, loading, error, progress, downloadUrl } =
  useFileUpload('image-compressor');
upload(file, { quality: 80 });
// progress: 0-100 (upload + processing combined)
// downloadUrl: blob URL once done
```

---

## 8. FILE PROCESSING — `server/services/fileProcessor.js`

Single file that handles all 20 new file tools. Routes look up the slug and call the right function.

### Image Tools (using `sharp`)
```javascript
processImage(inputPath, slug, options) → { outputPath, filename, mimeType }
```

Per slug:
- `image-compressor` → `sharp().jpeg({ quality })` or `png({ compressionLevel })`
- `image-resizer` → `sharp().resize(width, height, { fit })`
- `image-converter` → `sharp().toFormat(format)`
- `image-cropper` → `sharp().extract({ left, top, width, height })`
- `background-remover` → external API (`remove.bg` or self-hosted rembg) OR mark as "Coming Soon" in Phase 1 if no key available
- `image-to-grayscale` → `sharp().grayscale()`
- `image-rotator` → `sharp().rotate(angle)`
- `image-watermark` → `sharp().composite([{ input: svgTextBuffer, gravity, blend }])`
- `image-to-base64` → read file → `buffer.toString('base64')`
- `qr-code-generator` → `qrcode.toBuffer(text, { width, errorCorrectionLevel: 'M' })`

### Media Tools (using `fluent-ffmpeg`)
```javascript
processMedia(inputPath, slug, options) → { outputPath, filename, mimeType }
```

Per slug:
- `audio-converter` → `.toFormat(format)`
- `video-converter` → `.format(format).videoCodec('libx264').audioCodec('aac')`
- `audio-compressor` → `.audioBitrate(bitrate)`
- `video-compressor` → `.outputOptions(['-crf 28'])` (higher CRF = smaller file)
- `audio-trimmer` → `.setStartTime(start).setDuration(end - start)`
- `video-trimmer` → same + video copy codec for speed
- `audio-extractor` → `.noVideo().toFormat('mp3')`
- `video-to-gif` → `.outputOptions(['-vf', 'fps=10,scale=' + width + ':-1', '-t', duration])`
- `mute-video` → `.noAudio()` (`-an`)
- `change-video-speed` → `.videoFilters('setpts=' + (1/speed) + '*PTS').audioFilters('atempo=' + speed)`

### File Storage Rules
```
✅ Save to /tmp/innovatetools/ with uuid filename
✅ Original filename NEVER used
✅ Delete after 1 hour via cron job (server/jobs/cleanup.js)
❌ Never save to public/ folder
❌ Never expose raw paths in URLs
```

---

## 9. SECURITY — NON-NEGOTIABLE

### File Upload (`server/middleware/upload.js`)
```
imageUpload:
  - Max 10 MB
  - Accepted MIME: image/jpeg, image/png, image/webp, image/gif
  - Check actual MIME (multer file.mimetype) — NOT extension

mediaUpload:
  - Max 50 MB (video), 20 MB (audio)
  - Accepted MIME: audio/*, video/*
  - Reject anything else with 400

Filename: always uuid + correct extension
Destination: /tmp/innovatetools/
```

### Rate Limiting (`server/middleware/rateLimiter.js` — already exists)
```
Tool routes:  20/min per IP
Auth routes:  5/min per IP
Admin routes: no limit (already authenticated)
Fetch-source: 10/min per IP (citation auto-fetch can hit external APIs)
Contact form: 3/hour per IP
```

### Input Validation
```
- All text inputs: trim + max length (server-side)
- Slug params: regex /^[a-z0-9-]+$/ — reject otherwise
- URL inputs (citation auto-fetch): URL constructor validation
- ISBN: digits + 'X' only, length 10 or 13
- DOI: regex /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i
```

### Admin Routes
```
✅ ALL /api/admin/* protected by adminAuth middleware
✅ adminAuth checks: valid JWT + user.role === 'admin'
✅ Return 403 (not 401) if logged in but not admin
```

### CORS
```
Only allow CLIENT_URL from .env
```

### Bot Protection — Google reCAPTCHA v3

**Why v3:** invisible, no user friction, score-based decisions, admin-configurable threshold.

**Where reCAPTCHA fires:**
```
✅ Signup form          (POST /api/auth/register)
✅ Login form           (POST /api/auth/login)
✅ Password reset       (POST /api/auth/forgot-password)
✅ Contact form         (POST /api/contact)
✅ Email subscribe      (POST /api/subscribe)
✅ Anonymous tool runs  (POST /api/tools/:slug/run — if user not logged in)
✅ Anonymous file process (POST /api/tools/:slug/process — if user not logged in)

❌ Logged-in user tool usage    (already authenticated, skip)
❌ Admin panel actions          (already authenticated, skip)
```

**How it works (one-time setup):**
```
1. Register site at https://www.google.com/recaptcha/admin
2. Pick reCAPTCHA v3
3. Get two keys:
   - Site Key   → goes in frontend (public, OK to expose)
   - Secret Key → goes in backend .env (NEVER expose)
4. Both keys are editable from Admin Settings → Security tab
   (so admin can rotate without redeploy)
```

**Backend implementation:**
```
server/middleware/recaptcha.js

- Reads action + token from request body
- Calls https://www.google.com/recaptcha/api/siteverify
  with secret + token
- Google returns { success, score, action }
- Default threshold: score >= 0.5 passes
- Threshold editable from Admin Settings → Security
- Per-route override allowed (auth = stricter, contact = lenient)
- On fail: return 403 { error: 'Bot detection triggered' }
- Log all failures to UsageLog with type: 'recaptcha-fail'

Score thresholds (defaults, all admin-editable):
  Auth routes:    0.7  (stricter — credential stuffing prevention)
  Contact form:   0.5  (medium — most spam blocks)
  Tool usage:     0.3  (lenient — false positives hurt users)
  Subscribe:      0.5  (medium)
```

**Frontend implementation:**
```
client/src/hooks/useRecaptcha.js

- Loads grecaptcha script on first use
- Exposes: const { executeRecaptcha } = useRecaptcha()
- Usage: const token = await executeRecaptcha('login_action')
- Token attached to API request as { recaptchaToken, recaptchaAction }
- Site key loaded from /api/settings/public on app load
- If site key missing in DB → reCAPTCHA bypassed silently (dev mode)
```

**Admin Settings → Security tab adds these fields:**
```
- reCAPTCHA Site Key       (text input)
- reCAPTCHA Secret Key     (password input, masked)
- Enable reCAPTCHA         (master toggle)
- Threshold: Auth          (slider 0.0 — 1.0, default 0.7)
- Threshold: Contact       (slider 0.0 — 1.0, default 0.5)
- Threshold: Tools         (slider 0.0 — 1.0, default 0.3)
- Test reCAPTCHA button    (sends a test verify, shows score)
```

**Database (extends Setting model):**
```javascript
security: {
  recaptcha: {
    enabled: Boolean,
    siteKey: String,
    secretKey: String,       // encrypted at rest
    thresholds: {
      auth: Number,
      contact: Number,
      tools: Number,
      subscribe: Number
    }
  },
  toolRateLimit: Number,
  authRateLimit: Number,
  maxImageSize: Number,
  maxMediaSize: Number
}
```

**Honeypot fallback:**
Every form also includes a hidden honeypot field. If filled → reject immediately (bots fill all fields blindly, humans don't see the hidden one). This is a 5-line fallback that catches dumb bots that bypass reCAPTCHA somehow.

**Install:**
```
Frontend: react-google-recaptcha-v3
Backend:  axios (already installed for citation fetch)
```

---

## 10. CITATION GENERATOR FIX — DETAILED SPEC

### Source Types And Methods

```
Website         → URL input → axios + cheerio scrape meta tags
                  Extract: og:title, og:site_name, article:author, article:published_time

Book            → ISBN input → Open Library API (free, no key)
                  GET https://openlibrary.org/search.json?isbn={isbn}
                  Extract: title, author_name, publisher, publish_year, publish_place

Journal Article → DOI input → CrossRef API (free, no key)
                  GET https://api.crossref.org/works/{doi}
                  Extract: title, author, container-title, volume, issue, page, year, doi

Newspaper       → URL input → axios + cheerio (same as Website)
Magazine        → URL input → axios + cheerio (same as Website)
Report          → URL input → axios + cheerio (same as Website)

Thesis          → NO auto-fetch — manual only
                  Show message: "Thesis details must be entered manually"
```

### Response Shape (always — empty string if not found, never null)
```javascript
{
  title: '', author: '', year: '', publisher: '', url: '',
  journal: '', volume: '', issue: '', pages: '',
  doi: '', isbn: '',
  newspaperName: '', magazineName: ''
}
```

### Frontend Flow
```
1. Auto-fetch section ABOVE existing form
2. Show input matching source type:
   - Website/News/Mag/Report → URL field
   - Book → ISBN field
   - Journal → DOI field
   - Thesis → no fetch section, info text only
3. "Fetch Details" button → spinner while loading
4. On success: auto-fill matching form fields below
5. On fail: inline error "Could not fetch details — please fill in manually"
6. All fields editable after auto-fill
```

Install: `axios`, `cheerio` on server (if not already).

---

## 11. TEXT-TO-IMAGE FIX — UI IMPROVEMENT

Improve UI to a PixelLab-style flow:
```
1. Big text prompt area (multi-line)
2. Style presets: Photo / Anime / Sketch / 3D / Logo
3. Aspect ratio: 1:1 / 16:9 / 9:16 / 4:3
4. Quality: Standard / HD
5. Generate button → loader → image preview
6. Download + Regenerate buttons
7. History strip below (last 5 generated images this session)
```

Keep existing API integration — only the frontend UI changes here.

---

## 12. ADMIN PANEL — PHASE 1 SCOPE (FULL SAAS PLATFORM)

Admin panel is a **complete management console** built in violet/white.
All features are ORIGINAL code — these are industry-standard SaaS features,
implemented with our own design language, not copied from any paid product.

### Sidebar Navigation (Phase 1)

Two collapsible groups in the sidebar:

```
ADMINISTRATION (group)
  📊 Dashboard
  ⚙️  General Settings
  ✉️  SMTP / Email Settings
  🛠️  Web Tools Settings
  📺 Ad Settings
  💰 SaaS / Subscriptions
  📐 Tool Page Settings
  🔗 Tool Slugs / Permalinks
  🔒 Security (rate limits, reCAPTCHA, honeypot)

CONTENT (group)
  📝 Blog Posts
  📄 Pages (static content)
  ✉️  Contact Submissions
  📧 Email Subscribers

ACCOUNT (group)
  👥 Users
  👤 My Profile
```

Sidebar: violet-600 background, white text, collapses on mobile.
Top bar: site logo, admin name, notifications icon, logout.
Active item: white background, violet-700 text.

---

### 12.1 `/admin/dashboard`

**Top Stat Cards (4 cards in a row):**
- Total Users (with weekly delta)
- Today's Tool Uses (with hourly chart sparkline)
- All-Time Tool Uses
- Active Tools (count of `isActive: true`)

**Most Popular Tool Card:**
Large highlight card showing the #1 tool by usageCount with its icon.

**Widgets Below:**
- Line chart: tool usage last 7 days
- Top 10 tools by usageCount (table: tool name + views)
- Last 10 registered users (table: name, email, joined, status)
- Last 10 contact form submissions (table: name, subject, date)
- Server health card: uptime, /tmp folder size, queue length

---

### 12.2 `/admin/general-settings`

Single long form (saves on "Save Changes" button at bottom).

**Site Identity:**
- Website Title (used as `<title>` suffix)
- Website Description (homepage meta-description)
- Website Keywords (comma-separated meta keywords)
- Footer Attribution (e.g., "© InnovateTools. All Rights Reserved.")

**Branding:**
- Logo (upload, shown in light header)
- Contrasting Logo (upload, shown in dark header / footer)
- Favicon (upload, .ico or .png)
- OG Image (upload, for social sharing previews)

**Links:**
- Dynamic list: Add Link button
- Each link: label + URL + position (header / footer / both)
- Used for static links like About, Privacy, Contact in navigation

**Analytics & Tracking:**
- Google Analytics ID (e.g., G-XXXXXXXXXX)
- Custom CSS (textarea — injected globally)
- Custom Header Tags (textarea — injected in `<head>`)
- Custom Body Tags (textarea — injected before `</body>`)
- Custom Stylesheets (dynamic list — Add Stylesheet)
- Custom Scripts (dynamic list — Add Script)

**Model:** stored in `Setting.general` section.

---

### 12.3 `/admin/smtp-settings`

Email server configuration.

**Fields:**
- Host (e.g., smtp.gmail.com)
- Port (587 default for TLS)
- Encryption (none / TLS / SSL)
- Username
- Password (masked input)
- From Name (e.g., "InnovateTools Team")
- From Email
- Reply-To Email (optional)

**Actions:**
- "Send Test Email" button → opens modal with "Send to" field → sends test
- Status indicator: last successful send timestamp

**Model:** `Setting.smtp` section (password encrypted at rest).

---

### 12.4 `/admin/web-tools-settings`

**Important:** This is NOT for editing tool content (How-To, FAQs, etc.).
That happens in `/admin/tools` (Tools Manager).

This page is for **tool-level settings** that affect HOW the tool runs:

**Grouped by category:**
- Media Tools section
- Image Tools section
- AI Tools section
- Text Tools section

**Each tool shows a card with:**
- Tool name + short description
- "Settings" button → opens modal

**Per-tool settings modal:**
- Max file size override (default from global setting)
- Output format defaults (e.g., compressor default quality = 80)
- AI model override (e.g., this AI tool uses `llama-3.3-70b` vs `llama-3.1-8b`)
- Rate limit override (e.g., this tool = 5/min instead of global 20/min)
- Cache TTL (how long to cache result for same input)
- Cost per use (in tokens — used for Pro plan accounting)

**Model:** `Tool.runtimeSettings` (new sub-document on existing Tool model).

---

### 12.5 `/admin/ad-settings`

Configure ad placements site-wide. AdSense integration is **prepared but disabled**
in Phase 1 (per user decision — actual AdSense goes live in Phase 2).

**Master Switches:**
- Enable Ads on Site (master toggle)
- Hide Ads for Pro Users (toggle, on by default)

**Ad Slots (each is enable/disable + ad code textarea):**
- Header Banner (above navbar)
- Sidebar Top (desktop only)
- Sidebar Bottom (desktop only)
- Between Tool Header and Interface
- Between Tool Interface and How-To
- Between FAQ and Related Tools
- Footer Banner
- Mobile Sticky Bottom

**Provider Configuration:**
- Provider (Google AdSense / Custom HTML / Disabled)
- AdSense Publisher ID (e.g., ca-pub-XXXXXX)
- Auto Ads toggle (AdSense auto-placement)

**Note:** All slots are saved but only render if "Enable Ads" is on.

**Model:** `Setting.ads` section.

---

### 12.6 `/admin/saas-features`

SaaS subscription configuration. **Phase 1 = setup only, no live billing yet.**
This is the foundation that Phase 2 will activate.

**Master Switch:**
- "Enable SaaS Features" toggle
  - When OFF: site is fully free, no subscription UI shown
  - When ON: users see Pricing page, can subscribe

**Pricing:**
- Pro Plan / Per Month (e.g., $4.99)
- Pro Plan / Per Year (e.g., $49.99)
- Team Plan / Per Month (Phase 2 — placeholder field)
- Team Plan / Per Year (Phase 2 — placeholder field)
- Trial Days (e.g., 7 days free trial — 0 = no trial)

**Stripe Configuration:**
- Stripe Public Key (visible field — frontend uses this)
- Stripe Secret Key (masked field — server only)
- Stripe Webhook Secret (masked field)
- Test Mode toggle (use Stripe test keys for development)
- "Test Stripe Connection" button

**PayPal Configuration:**
- PayPal Client ID
- PayPal Secret (masked)
- PayPal Mode (Sandbox / Live)
- "Test PayPal Connection" button

**Plan Features (text list — what each plan unlocks):**
- Free Plan features (default: "Basic tools, 20 uses/day, ads visible")
- Pro Plan features (default: "All tools, unlimited uses, no ads, priority processing")
- Team Plan features (Phase 2 — leave blank)

**Premium Tool Gating:**
- Each tool in Tools Manager has an `isPremium` checkbox
- Phase 1: flag is set but not enforced (all tools free)
- Phase 2: middleware checks `user.plan === 'pro'` before allowing premium tools

**Model:** `Setting.saas` section (keys encrypted at rest).

---

### 12.7 `/admin/tool-page-settings`

Controls how tool pages render globally (applies to ALL tool pages).

**Tool Page Sections (each can be hidden/shown globally):**
- Show Tool Header
- Show Tool Interface (always on — disabled toggle)
- Show How-To Section
- Show FAQ Section
- Show Related Tools Section
- Show What/Who/When Cards
- Show "Try Pro" Banner (Phase 2)
- Show Comments Section (Phase 2)

**Layout:**
- Tool page max-width (e.g., 1200px)
- Show category badge (yes/no)
- Show usage count on tool page (yes/no)
- Show "last updated" date (yes/no)

**Behavior:**
- Auto-scroll to result after processing (yes/no)
- Show loading spinner style (dots / bar / spinner)
- Default sort order in tool listings (popular / newest / alphabetical)

**SEO Defaults:**
- Default SEO title template (e.g., "{toolTitle} - Free Online Tool | {siteName}")
- Default SEO description template

**Model:** `Setting.toolPage` section.

---

### 12.8 `/admin/tool-slugs`

Manage tool URLs (permalinks).

**Table:** every tool with:
- Current slug (editable inline)
- Public URL preview
- Last changed date
- Save button per row

**Validation:**
- Slug must match `/^[a-z0-9-]+$/`
- Slug must be unique
- Warning on change: "Old URL will 301 redirect to new URL"

**Redirect Management:**
- When slug changes, old slug saved to `Tool.previousSlugs[]`
- Public route checks: if request matches a `previousSlugs` entry, 301 redirect to current

**Model:** extends existing `Tool` model with `previousSlugs: [String]`.

---

### 12.9 `/admin/security` (was previously merged with Settings)

Dedicated security configuration page.

**Rate Limits:**
- Tool routes (per IP per minute) — default 20
- Auth routes (per IP per minute) — default 5
- Contact form (per IP per hour) — default 3
- File processing (per IP per minute) — default 10

**File Upload Limits:**
- Max image size (MB) — default 10
- Max video size (MB) — default 50
- Max audio size (MB) — default 20
- Allowed image MIME types (checklist)
- Allowed media MIME types (checklist)

**reCAPTCHA v3:** (see Section 9 for full spec)
- Enable / Disable master toggle
- Site Key field
- Secret Key (masked)
- Score threshold sliders per route type
- "Test reCAPTCHA" button

**Honeypot:**
- Enable honeypot field
- Honeypot field name (default: 'website_url')

**Bot Protection:**
- Block known bot user-agents (toggle + list)
- Block VPN/proxy IPs (Phase 2 — placeholder)
- IP whitelist (always allow)
- IP blacklist (always deny)

**Model:** `Setting.security` section.

---

### 12.10 `/admin/blog-posts`

Full blog CMS.

**List Page:**
- Table: title, slug, category, status (draft/published), author, date
- Filter: by status, category, author
- Search: by title
- "New Blog Post" button (top right)
- Bulk actions: publish, unpublish, delete

**New/Edit Post Page:**
- Title (auto-generates slug, slug editable)
- Slug (URL preview)
- Category (dropdown — managed in Tool category enum)
- Cover Image (upload)
- Excerpt (short summary, ~160 chars)
- Body (markdown editor with live preview)
- Tags (comma-separated)
- Featured (boolean — show on homepage)
- Status (draft / published / scheduled)
- Publish Date (datetime — for scheduled)
- Author (dropdown of admin users)
- SEO Title
- SEO Description
- SEO Keywords
- Related Tools (multi-select — shown in sidebar of blog post)

**Public Routes:**
- `/blog` — listing with pagination, filters
- `/blog/:slug` — single post
- `/blog/category/:cat` — category page
- `/blog/tag/:tag` — tag page

**Model:** new `server/models/Post.js`

```javascript
{
  slug: String,           // unique
  title: String,
  excerpt: String,
  body: String,           // markdown
  coverImage: String,
  category: String,
  tags: [String],
  author: ObjectId,       // ref: User
  status: String,         // draft | published | scheduled
  publishDate: Date,
  featured: Boolean,
  seoTitle: String,
  seoDescription: String,
  seoKeywords: String,
  relatedTools: [String], // tool slugs
  views: Number,
  createdAt: Date,
  updatedAt: Date
}
```

---

### 12.11 `/admin/pages`

Static page CMS — About, Privacy, Terms, Cookie Policy, etc.

**List Page:**
- Table: title, slug, last updated, status, "Edit" button
- "New Page" button

**New/Edit Page:**
- Title
- Slug (URL preview, e.g., `/about`)
- Body (markdown editor with live preview)
- SEO Title
- SEO Description
- Status (draft / published)
- Show in Footer (toggle)
- Show in Navbar (toggle)
- Order (number, for sorting in nav/footer)

**Default pages seeded:**
- About Us (`/about`)
- Privacy Policy (`/privacy`)
- Terms of Service (`/terms`)
- Cookie Policy (`/cookies`)
- Contact (`/contact`)

**Public Route:** `/:slug` (e.g., `/about`)

**Model:** new `server/models/Page.js`

```javascript
{
  slug: String,           // unique, kebab-case
  title: String,
  body: String,           // markdown
  seoTitle: String,
  seoDescription: String,
  status: String,         // draft | published
  showInFooter: Boolean,
  showInNavbar: Boolean,
  order: Number,
  updatedAt: Date,
  createdAt: Date
}
```

---

### 12.12 `/admin/contact`

Read-only inbox for contact form submissions.

**Table columns:** name, email, subject, date, status (new/read/replied/archived)
**Row click:** expand to read full message
**Actions per row:**
- Mark as read / replied / archived
- Reply button → opens `mailto:` link with pre-filled subject
- Delete (with confirm)

**Filters:** by status, date range, search by email
**Bulk:** mark all read, delete selected

**Model:** new `server/models/ContactSubmission.js`

```javascript
{
  name: String,
  email: String,
  subject: String,
  message: String,
  status: String,        // new | read | replied | archived
  ipAddress: String,
  userAgent: String,
  submittedAt: Date
}
```

**Public Route:** `POST /api/contact` (rate-limited 3/hour per IP + reCAPTCHA)

---

### 12.13 `/admin/subscribers`

Manages the existing `EmailCapture.js` model.

**Table:** email, source (which page captured them), date subscribed
**Actions:**
- Export to CSV (all or filtered)
- Delete subscriber
- Search by email
- Filter by source

**Future (Phase 2):** Send broadcast email to all subscribers.

---

### 12.14 `/admin/users`

User management — extends existing `User.js`.

**Table columns:** name, email, role (user/admin), plan (free/pro/team), joined, last login, status

**Search:** by email or name
**Filters:** by role, by plan, by status

**Actions per user (row menu):**
- View profile + usage history modal
- Change role (toggle user ↔ admin)
- Change plan (free / pro / team) — Phase 1 sets flag only
- Ban / unban (sets `user.banned = true`)
- Reset password (sends email via SMTP)
- Delete account (with confirm — soft delete recommended)

**"New User" button:**
- Create user manually with email + temporary password + role
- Sends welcome email with login link

**Bulk:** ban selected, export emails to CSV.

---

### 12.15 `/admin/profile`

Admin's own profile management.

**Fields:**
- Name
- Email
- Avatar upload
- Current Password (required to change anything)
- New Password
- Confirm Password
- Two-Factor Auth (Phase 2)

**Sessions:**
- List of active sessions (device, IP, last activity)
- "Log out all other sessions" button

---

### 12.16 Phase 1 Admin Models (Full List)

```
🆕 server/models/Tool.js                (with previousSlugs[] + runtimeSettings)
🆕 server/models/Page.js                (static pages)
🆕 server/models/Post.js                (blog posts)
🆕 server/models/ContactSubmission.js   (contact form)
🆕 server/models/Setting.js             (one doc, key-value sections)
✅ server/models/User.js                (existing, may add role + plan + banned)
✅ server/models/UsageLog.js            (existing)
✅ server/models/EmailCapture.js        (existing)
```

---

### 12.17 Setting Model — Full Shape

Single document, structured as nested sections (one source of truth for site config):

```javascript
{
  general: {
    siteName, siteDescription, keywords, footerAttribution,
    logo, contrastingLogo, favicon, ogImage,
    links: [{ label, url, position }],
    googleAnalyticsId,
    customCss, customHeaderTags, customBodyTags,
    customStylesheets: [String], customScripts: [String]
  },
  smtp: {
    host, port, encryption, username, password,
    fromName, fromEmail, replyToEmail,
    lastTestAt
  },
  ads: {
    enabled, hideForPro,
    slots: {
      headerBanner: { enabled, code },
      sidebarTop: { enabled, code },
      sidebarBottom: { enabled, code },
      // ...all 8 slots
    },
    provider, adsensePublisherId, autoAds
  },
  saas: {
    enabled,
    pricing: {
      proMonthly, proYearly,
      teamMonthly, teamYearly,
      trialDays
    },
    stripe: { publicKey, secretKey, webhookSecret, testMode },
    paypal: { clientId, secret, mode },
    planFeatures: { free: [String], pro: [String], team: [String] }
  },
  toolPage: {
    showHeader, showHowTo, showFaq, showRelated, showCards,
    showProBanner, showComments,
    maxWidth, showCategoryBadge, showUsageCount, showLastUpdated,
    autoScrollToResult, loadingStyle, defaultSortOrder,
    seoTitleTemplate, seoDescriptionTemplate
  },
  security: {
    rateLimits: { tool, auth, contact, fileProcess },
    uploadLimits: { maxImage, maxVideo, maxAudio,
                    allowedImageMimes: [String], allowedMediaMimes: [String] },
    recaptcha: { enabled, siteKey, secretKey,
                 thresholds: { auth, contact, tools, subscribe } },
    honeypot: { enabled, fieldName },
    botBlocking: { blockKnownBots, blockVpn,
                   ipWhitelist: [String], ipBlacklist: [String] }
  }
}
```

Encrypted fields at rest: `smtp.password`, `saas.stripe.secretKey`,
`saas.stripe.webhookSecret`, `saas.paypal.secret`, `security.recaptcha.secretKey`.

---

### 12.18 NOT In Phase 1 Admin (moved to Phase 2)

```
❌ Live Stripe checkout flow (config exists, actual billing in Phase 2)
❌ Live PayPal checkout flow (config exists, actual billing in Phase 2)
❌ Social login OAuth flow (config UI in Phase 2)
❌ Multi-language management (Phase 2)
❌ Live AdSense ad serving (slots configured, rendering in Phase 2)
❌ Affiliate link manager (Phase 2)
❌ Workspace / B2B ad slot manager (Phase 2)
❌ Email broadcast to subscribers (Phase 2)
❌ Two-factor authentication (Phase 2)
❌ Comment moderation on blog posts (Phase 2)
```

These all live in Section 18 (Phase 2 Roadmap).

---

## 13. ADDING A NEW TOOL — CHECKLIST

Every new tool requires ALL of these:

**Backend**
- [ ] Add entry to `server/seeds/tools.js`
- [ ] AI tool? Add prompt to `server/services/groq.js`
- [ ] File tool? Add case in `server/services/fileProcessor.js`
- [ ] Routes already exist generically — no per-tool route needed

**Frontend**
- [ ] Create `client/src/pages/tools/ToolNamePage.jsx`
- [ ] Wrap in `<ToolPageLayout slug="tool-slug">`
- [ ] Add route in `App.jsx`: `/tools/tool-slug`
- [ ] DO NOT add to any hardcoded array

**Admin**
- [ ] Tool appears automatically in Admin Tools Manager
- [ ] Admin fills howToUse / faqs / SEO from panel

---

## 14. NAMING CONVENTIONS

```
Files (pages/components):  PascalCase  → ImageCompressorPage.jsx
React components:          PascalCase  → ToolPageLayout
Hooks:                     camelCase   → useFileUpload
Frontend routes:           kebab-case  → /tools/image-compressor
DB slugs:                  kebab-case  → 'image-compressor'
API endpoints:             kebab-case  → /api/tools/image-compressor/process
ENV variables:             SCREAMING   → MONGODB_URI, GROQ_API_KEY
```

---

## 15. DO NOT DO — EVER

```
❌ Hardcode tool list in any frontend file
❌ Store uploaded files in public/ folder
❌ Use the user's original filename
❌ Skip rate limiting on any public route
❌ Put API keys in frontend code
❌ Use inline styles — Tailwind classes only
❌ Create new CSS files — Tailwind only
❌ Skip the ToolPageLayout wrapper on a tool page
❌ Add tool data anywhere except server/seeds/tools.js
❌ Use any color outside the violet/white scheme
❌ Modify the 10 working tools' logic in Phase 1
❌ Run seedDB on production database after launch
```

---

## 16. PACKAGES REFERENCE

### Server (Phase 1 installs)
```
sharp                          ← image processing
fluent-ffmpeg                  ← media processing
ffmpeg-static                  ← bundled ffmpeg binary
multer                         ← file upload middleware
uuid                           ← safe filenames
node-cron                      ← /tmp cleanup every hour
qrcode                         ← QR generation
axios                          ← citation auto-fetch + reCAPTCHA verify
cheerio                        ← citation auto-fetch HTML parse
bcryptjs                       ← password hashing (if not installed)
jsonwebtoken                   ← JWT for auth (if not installed)
nodemailer                     ← SMTP for emails
groq-sdk                       ← AI (already installed)
```

### Client (Phase 1 installs)
```
react-dropzone                 ← drag & drop upload
react-image-crop               ← cropper UI
react-google-recaptcha-v3      ← reCAPTCHA v3 hook + provider
react-markdown                 ← static page rendering
@uiw/react-md-editor           ← markdown editor for admin
lucide-react                   ← icons (already installed)
axios                          ← API calls (already installed)
```

---

## 17. PHASE 1 EXECUTION ORDER — PARALLEL (BACKEND + FRONTEND + ADMIN TOGETHER)

Backend, public frontend, and admin panel grow together — never one in isolation.
Each step ends with a working, testable slice.

```
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 1 — FOUNDATION (Tool model + SeedDB + Auth check)               │
├──────────────────────────────────────────────────────────────────────┤
│ Backend:   server/models/Tool.js                                     │
│            server/models/User.js  (add role field if missing)        │
│            server/seeds/tools.js (all 30 tool entries)               │
│            server/seedDB.js (also seeds 1 default admin user)        │
│            Run: node server/seedDB.js                                │
│ Verify:    MongoDB Compass shows 30 tools + 1 admin user             │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 2 — PUBLIC TOOL API + ADMIN AUTH MIDDLEWARE                     │
├──────────────────────────────────────────────────────────────────────┤
│ Backend:   GET  /api/tools                                           │
│            GET  /api/tools/:slug                                     │
│            server/middleware/auth.js (verify JWT)                    │
│            server/middleware/adminAuth.js (verify role=admin)        │
│ Verify:    Postman: tools API works, admin endpoint blocks non-admin │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 3 — ADMIN BACKEND: TOOLS + STATS                                │
├──────────────────────────────────────────────────────────────────────┤
│ Backend:   server/routes/admin.js                                    │
│            server/controllers/adminController.js                     │
│            Routes:                                                   │
│              GET   /api/admin/stats                                  │
│              GET   /api/admin/tools                                  │
│              PUT   /api/admin/tools/:id                              │
│              PATCH /api/admin/tools/:id/toggle                       │
│              GET   /api/admin/tools/export                           │
│ Verify:    Postman with admin JWT: every endpoint returns 200        │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 4 — ADMIN BACKEND: USERS                                        │
├──────────────────────────────────────────────────────────────────────┤
│ Backend:   GET    /api/admin/users                                   │
│            GET    /api/admin/users/:id                               │
│            PATCH  /api/admin/users/:id                               │
│            PATCH  /api/admin/users/:id/ban                           │
│            POST   /api/admin/users/:id/reset                         │
│            DELETE /api/admin/users/:id                               │
│ Verify:    Each user endpoint works in Postman                       │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 5 — ADMIN BACKEND: BLOG / PAGES / CONTACT / SETTINGS            │
├──────────────────────────────────────────────────────────────────────┤
│ Backend:   server/models/Page.js                                     │
│            server/models/Post.js                                     │
│            server/models/ContactSubmission.js                        │
│            server/models/Setting.js (full nested schema)             │
│            All /api/admin/posts/* routes                             │
│            All /api/admin/pages/* routes                             │
│            All /api/admin/contact/* routes                           │
│            All /api/admin/subscribers/* routes                       │
│            All /api/admin/settings/* routes (general/smtp/ads/       │
│              saas/tool-page/security)                                │
│            All /api/admin/web-tools-settings/* routes                │
│            All /api/admin/profile/* routes                           │
│            POST /api/admin/upload (file upload helper)               │
│            Public: POST /api/contact, GET /api/pages/:slug,          │
│                    GET /api/posts/*, GET /api/settings/public        │
│ Seed:      Default pages: about, privacy, terms, cookies, contact    │
│ Verify:    Each endpoint tested in Postman                           │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 6 — ADMIN FRONTEND SHELL (Layout + Dashboard)                   │
├──────────────────────────────────────────────────────────────────────┤
│ Frontend: client/src/layouts/AdminLayout.jsx                         │
│             - Sidebar with grouped nav (Administration / Content /   │
│               Account) — collapsible groups                          │
│             - Top bar: logo, admin name, notifications, logout       │
│             - Protected route: redirect to /login if not admin       │
│           client/src/pages/admin/AdminDashboard.jsx                  │
│             - 4 stat cards + most popular tool highlight             │
│             - Charts + top tools + recent users + recent contacts    │
│ Verify:   Admin login → /admin/dashboard shows live stats            │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 7 — ADMIN FRONTEND: TOOLS GROUP                                 │
├──────────────────────────────────────────────────────────────────────┤
│ Frontend: client/src/pages/admin/AdminTools.jsx                      │
│             - Table with all 30 tools                                │
│             - Edit modal: ALL Tool fields                            │
│           client/src/pages/admin/AdminWebToolsSettings.jsx           │
│             - Per-category tool cards with Settings modal            │
│             - Runtime settings per tool (file size, rate limit, etc.)│
│           client/src/pages/admin/AdminToolSlugs.jsx                  │
│             - Inline slug edit + 301 redirect handling               │
│           client/src/pages/admin/AdminToolPageSettings.jsx           │
│             - Section toggles + layout settings + SEO templates      │
│ Verify:   Edit a tool's shortDesc → save → public page reflects      │
│           Change a slug → old URL 301-redirects to new               │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 8 — ADMIN FRONTEND: CONTENT GROUP (Blog + Pages + Contact)      │
├──────────────────────────────────────────────────────────────────────┤
│ Frontend: client/src/pages/admin/AdminBlogPosts.jsx                  │
│             - Posts table with filters + bulk actions                │
│             - New/Edit post: markdown editor + SEO + related tools   │
│           client/src/pages/admin/AdminPages.jsx                      │
│             - Pages table + new/edit with markdown editor            │
│           client/src/pages/admin/AdminContact.jsx                    │
│             - Read-only inbox with status workflow                   │
│           client/src/pages/admin/AdminSubscribers.jsx                │
│             - List + CSV export                                      │
│ Verify:   Create blog post → publish → /blog/:slug renders it        │
│           Edit about page → /about renders updated content           │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 9 — ADMIN FRONTEND: SETTINGS GROUP                              │
├──────────────────────────────────────────────────────────────────────┤
│ Frontend: client/src/pages/admin/AdminGeneralSettings.jsx            │
│             - Site identity + branding + links + analytics + CSS/JS  │
│           client/src/pages/admin/AdminSmtpSettings.jsx               │
│             - SMTP config + "Send Test Email" button                 │
│           client/src/pages/admin/AdminAdSettings.jsx                 │
│             - Master toggle + 8 ad slot toggles + provider config    │
│           client/src/pages/admin/AdminSaasSettings.jsx               │
│             - Pricing + Stripe + PayPal + plan features              │
│           client/src/pages/admin/AdminSecuritySettings.jsx           │
│             - Rate limits + reCAPTCHA + honeypot + bot blocking      │
│           client/src/pages/admin/AdminUsers.jsx                      │
│             - User table + create/edit/ban/delete                    │
│           client/src/pages/admin/AdminProfile.jsx                    │
│             - Own profile + password change + active sessions        │
│ Verify:   Each settings page saves and persists. SMTP test sends     │
│           a real email. reCAPTCHA test returns a score.              │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 10 — RECAPTCHA INTEGRATION                                      │
├──────────────────────────────────────────────────────────────────────┤
│ Backend:  server/middleware/recaptcha.js (verify token + score)      │
│           Apply to: /auth/register, /auth/login, /auth/forgot,       │
│                     /contact, /subscribe,                            │
│                     /tools/:slug/run (when not authenticated),       │
│                     /tools/:slug/process (when not authenticated)    │
│           Read keys + thresholds from Setting.security.recaptcha     │
│ Frontend: client/src/hooks/useRecaptcha.js                           │
│           Wrap App in GoogleReCaptchaProvider                        │
│           Add executeRecaptcha() call to all protected forms         │
│           Add honeypot hidden field to all forms                     │
│ Setup:    Admin opens /admin/security                                │
│           Enters Site Key + Secret Key from Google reCAPTCHA console │
│           Clicks "Test reCAPTCHA" → confirms score returns           │
│ Verify:   Submit contact form with valid session → passes            │
│           Submit from curl/Postman without token → 403 blocked       │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 11 — PUBLIC SHARED COMPONENTS                                   │
├──────────────────────────────────────────────────────────────────────┤
│ Frontend: client/src/components/tools/ToolPageLayout.jsx             │
│           client/src/hooks/useToolRun.js                             │
│           client/src/hooks/useFileUpload.js                          │
│           client/src/pages/StaticPage.jsx (renders DB pages)         │
│           client/src/pages/Contact.jsx (with form + reCAPTCHA)       │
│           client/src/pages/Blog.jsx (listing)                        │
│           client/src/pages/BlogPost.jsx (single post)                │
│ Verify:   Static pages render from DB, contact form submits,         │
│           blog posts list + single post render                       │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 12 — MIGRATE 10 EXISTING TOOL PAGES TO ToolPageLayout           │
├──────────────────────────────────────────────────────────────────────┤
│ Frontend: Wrap each existing page in <ToolPageLayout slug="...">     │
│ Verify:   Each tool still works AND shows How-To/FAQ/Related         │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 13 — REMOVE article-rewriter CLEANLY                            │
├──────────────────────────────────────────────────────────────────────┤
│ Delete page + route + seed entry + groq prompt                       │
│ Verify:   /tools/article-rewriter returns 404                        │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 14 — FIX citation-generator (auto-fetch)                        │
├──────────────────────────────────────────────────────────────────────┤
│ Backend:  POST /api/tools/citation-generator/fetch-source            │
│ Frontend: Auto-fetch section above existing form                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 15 — FIX text-to-image UI (PixelLab style)                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 16 — FILE PROCESSING BACKEND                                    │
├──────────────────────────────────────────────────────────────────────┤
│ Backend:  server/middleware/upload.js                                │
│           server/services/fileProcessor.js (all 20 cases)            │
│           server/jobs/cleanup.js (hourly /tmp purge)                 │
│           POST /api/tools/:slug/process route                        │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 17 — 10 IMAGE TOOL PAGES                                        │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 18 — 10 MEDIA TOOL PAGES                                        │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ STEP 19 — POLISH + ROUTING + SMOKE TEST                              │
├──────────────────────────────────────────────────────────────────────┤
│ Navbar + Footer → violet/white (use Setting.general for links/logo)  │
│ Ad slots render on tool pages (using Setting.ads config)             │
│ All routes registered in App.jsx                                     │
│ Full smoke test: every public page, every admin page, every tool     │
│ reCAPTCHA verified on all protected forms                            │
└──────────────────────────────────────────────────────────────────────┘
```

### Rules For Parallel Development

```
✅ After every step, the 10 existing tools must still work.
✅ Admin backend (Steps 3-5) is built BEFORE admin frontend (Steps 6-9)
   per your decision: backend pehle, phir frontend.
✅ Step 10 (reCAPTCHA) comes AFTER admin security UI exists, because
   admin must be able to configure site/secret keys via the panel.
✅ Each step is independently testable (Postman or browser).
✅ Steps 1-2 are the foundation — don't start anything else until they pass.
✅ Steps 3-9 deliver a complete working admin panel.
✅ Step 10 hardens auth + public forms before they get user traffic.
✅ Steps 11-19 build public tool features on top of the secure foundation.
```

### Why This Order

```
1-2:   Foundation. Without Tool model + auth, nothing works.
3-5:   ENTIRE admin BACKEND in 3 steps. Postman-testable.
       After Step 5, every admin API endpoint exists and works.
6-9:   ENTIRE admin FRONTEND. Each page hooks into existing API.
       After Step 9, you have a 100% working admin panel.
10:    reCAPTCHA layered in. Admin configures keys via UI built in 6-9.
       Public forms get protected BEFORE they go live.
11-12: Public layout + existing tools migrated → live site stable.
13-15: Cleanup tasks (remove article-rewriter, fix citation + text-to-image).
16:    Big backend lift — file processing infrastructure.
17-18: 20 new tool pages — mechanical now that infrastructure exists.
19:    Polish + final integration.
```

---

## 18. PHASE 2 ROADMAP — REVENUE & GROWTH FEATURES (NOT IN PHASE 1)

These are documented here so we don't lose track. Do not build in Phase 1.

### 18.1 Subscriptions / Billing (SaaS Core)
```
Free plan:    rate-limited, ads visible, basic tools only
Pro plan:     no ads, higher limits, premium tools, priority processing
Team plan:    multi-user workspaces, shared usage pool, admin tools

Payment gateways:
  - Stripe Checkout (primary — international)
  - PayPal (secondary — wider Pakistan acceptance)
  - Bank transfer (manual approval for Pakistani local payments)

Tech:
  - server/models/Subscription.js
  - server/models/Payment.js
  - server/middleware/requirePlan.js
  - Tool.isPremium gating on backend + frontend
  - Webhook handlers for both Stripe and PayPal
  - Admin: /admin/billing dashboard (MRR, churn, failed payments)
```

### 18.2 Social Login
```
Providers (in priority order):
  - Google OAuth (highest signup conversion)
  - Facebook (good for Pakistan market)
  - GitHub (developer audience)

Tech:
  - Passport.js or custom OAuth2 flow
  - server/routes/oauth.js
  - Account linking: same email → merge accounts
  - Admin: Settings → Social Login (toggle each provider + add client ID/secret)
```

### 18.3 Multi-Language Support
```
Languages to support (in priority order):
  - English (default)
  - Urdu (primary Pakistan)
  - Arabic (Middle East reach)
  - Hindi (India reach)

Tech:
  - react-i18next for frontend
  - Translation files: client/src/locales/{en,ur,ar,hi}.json
  - Admin: /admin/translations (edit any string per language)
  - Tool content (howToUse/faqs) becomes per-language: { en: [...], ur: [...] }
  - RTL support for Urdu and Arabic
  - URL strategy: /ur/tools/image-compressor (subpath)
```

### 18.4 Google AdSense Integration
```
- Ad slot positions defined in admin panel:
    * Banner above tool interface
    * Sidebar (desktop only)
    * Between How-To and FAQ sections
    * Footer
- Each slot: enable/disable + AdSense ad code
- Pro users: ads hidden entirely
- Admin Settings → AdSense tab (publisher ID + auto ads toggle)
- Compliance: AdSense-friendly content + privacy policy
```

### 18.5 Affiliate Marketing
```
- Affiliate link manager in admin panel
- Tool sidebar widget: "Recommended tools" (affiliate links)
- Blog posts with embedded affiliate links
- Tracking via UTM + custom referral codes
- server/models/AffiliateLink.js + server/models/Click.js
- Admin dashboard: clicks, conversions, revenue per link
```

### 18.6 Company Workspaces (B2B Ads)
```
- Companies sign up for a workspace
- Each workspace can run sponsored placements:
  - Banner above tool interface
  - "Sponsored by X" footer on result pages
  - Featured slot in tools listing
- server/models/Workspace.js + server/models/AdSlot.js
- Admin approves ads before they go live
- Self-service ad upload + Stripe payment per slot
- Targets Pakistani businesses (ties into ProspectIQ lead flow)
```

### 18.7 Blog System (SEO Engine)
```
- /blog                   → listing page with categories
- /blog/:slug             → article page
- /admin/blog             → admin CRUD with markdown editor
- server/models/Post.js   (title, slug, body, coverImage, tags, author, publishedAt, category)
- server/models/Comment.js (optional, with moderation)
- SEO: meta tags, sitemap.xml, RSS feed, schema.org JSON-LD
- Categories aligned with tool categories (SEO clustering)
- Internal linking: blog posts ↔ related tools
```

### 18.8 Premium Tools / Advanced Features
```
Examples of Pro-only tools (Phase 2):
  - Bulk image processing (process 100+ images at once)
  - AI image upscaler
  - AI video enhancer
  - Batch citation generator
  - Team-shared tool history
  - API access for developers (rate-limited keys)
```

### 18.9 Notifications & Email System
```
- Transactional emails: welcome, password reset, payment receipt
- Marketing emails: from EmailCapture list (admin sends from panel)
- In-app notifications (admin announcements, plan limit warnings)
- server/services/emailService.js (uses SMTP from Settings)
- Email templates in DB (admin editable)
```

> **Important Note On CyberTools Reference**
>
> We are inspired by the general SHAPE of mature SaaS tool platforms
> (multi-tool + blog + admin + billing). Standard SaaS features like
> Stripe integration, SMTP config, social login — these are industry
> standards, NOT anyone's intellectual property.
>
> However, we do NOT:
> - Copy any code from CyberTools or similar paid products
> - Copy their exact admin panel layouts pixel-for-pixel
> - Use their proprietary design system
>
> Everything in InnovateTools is original code written for this project.

### 18.10 Phase 2 Build Order (when we get there)
```
1. Auth roles + plan field on User (extend existing User.js)
2. Stripe + PayPal integration → Subscription model
3. Premium tool gating (use isPremium flag already in Tool model)
4. Blog system (highest SEO impact — do early)
5. Social login (signup conversion)
6. AdSense integration (passive revenue)
7. Multi-language (after market validation)
8. Affiliate link manager
9. Workspaces + ad slots (most complex — do last)
10. Premium tools (bulk, AI upscale, etc.)
```

---

## 19. ONE-LINE SUMMARY

> **Phase 1** = MongoDB-backed tool platform with 10 protected existing tools, 20 new file tools, fixed citation/text-to-image, removed article-rewriter, plus a **complete SaaS admin panel** (Dashboard / Tools / Web Tool Settings / Tool Slugs / Tool Page Settings / Blog Posts / Pages / Contact / Subscribers / Users / Profile / General / SMTP / Ads / SaaS / Security) — all violet/white, all original code, all built in parallel.
> **Phase 2** = activate billing (Stripe + PayPal) + social login + AdSense rendering + multi-language + affiliates + workspaces + B2B ad slots.

---

## 20. CONTEXT WINDOW STRATEGY (for VS Code Claude)

Since admin + public + backend grow together, **never ask Claude to do a full step in one prompt** — context will explode.

Instead, break each step into **mini-prompts**:

```
GOOD prompt:
  "Step 3 part A: create server/routes/admin.js with the 6 admin routes.
   Show full code for admin.js only."

BAD prompt:
  "Do all of Step 3 — backend + frontend + tests."
```

Recommended mini-prompt size:
- 1 backend file at a time, OR
- 1 frontend page + its component, OR
- 1 admin page + its API integration

After each mini-prompt: test, commit, move on. This way nothing breaks
and the AI has enough room to write quality code.

---

*End of skill.md. If you find yourself wanting to do something not described here, stop and update this file first.*
