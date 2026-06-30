# ToolPlatform — globaltechtool.com

Free AI Tools Platform — AI Humanizer, AI Detector, Tone Changer, Plagiarism Checker, Word Counter.

---

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS + React Router + Axios
- **Backend:** Node.js + Express + MongoDB + Gemini AI
- **Hosting:** Hostinger (Node.js)

---

## Local Development Setup

### Step 1 — Clone / create project
```bash
# Already created — just go to folder
cd toolplatform
```

### Step 2 — Install all dependencies
```bash
npm run install:all
```

### Step 3 — Create .env file
```bash
cd server
cp .env.example .env
# Now open .env and fill in your values:
# GEMINI_API_KEY — get from https://ai.google.dev
# MONGODB_URI    — get from https://cloud.mongodb.com
# JWT_SECRET     — any random 32+ char string
```

### Step 4 — Start development
```bash
# Go back to root
cd ..
npm run dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:5000
```

### Step 5 — Test
```
http://localhost:5173                      → Homepage
http://localhost:5173/tools/ai-humanizer  → AI Humanizer
http://localhost:5000/api/health           → API check
http://localhost:5000/sitemap.xml          → Sitemap
```

---

## Adding a New Tool (Future)

1. Add tool config in `server/constants/tools.js`
2. Add Gemini prompt in `server/services/gemini.js`
3. Add frontend config in `client/src/data/tools.js`
4. Done! Routes, SEO, UI are all automatic.

---

## Hostinger Deployment

### Step 1 — Build React
```bash
cd client && npm run build
```

### Step 2 — Upload to Hostinger
- Upload entire project to `public_html/tools/`
- `client/dist` contents go to `public_html/tools/`
- `server/` goes to `public_html/tools/server/`

### Step 3 — Setup Node.js in cPanel
```
Node.js version : 20.x
App root        : public_html/tools/server
Startup file    : server.js
App URL         : globaltechtool.com
```

### Step 4 — Environment Variables
Add in cPanel Node.js section:
```
GEMINI_API_KEY=...
MONGODB_URI=...
JWT_SECRET=...
NODE_ENV=production
PORT=3000
```

### Step 5 — Run npm install + Start
Click "Run NPM Install" then "Start" in cPanel.

---

## API Endpoints

| Method | Endpoint                  | Description         |
|--------|---------------------------|---------------------|
| GET    | /api/tools                | List all tools      |
| GET    | /api/tools/:slug          | Single tool info    |
| POST   | /api/tools/:slug/run      | Run a tool          |
| GET    | /api/tools/:slug/usage    | Check daily usage   |
| POST   | /api/tools/capture-email  | Save email          |
| GET    | /api/health               | Health check        |
| GET    | /sitemap.xml              | SEO sitemap         |
| GET    | /robots.txt               | Robots file         |

---

## Project Structure

```
toolplatform/
├── client/                 ← React frontend
│   ├── src/
│   │   ├── components/     ← Navbar, Footer, ToolCard, etc.
│   │   ├── pages/          ← HomePage, ToolPage, CategoryPage
│   │   ├── hooks/          ← useToolRun, useClipboard
│   │   ├── layouts/        ← MainLayout
│   │   ├── data/tools.js   ← ALL tool configs (frontend)
│   │   ├── services/api.js ← Axios instance
│   │   └── styles/
│   └── public/
│
└── server/                 ← Express backend
    ├── constants/tools.js  ← ALL tool configs (backend)
    ├── services/gemini.js  ← AI service
    ├── middleware/         ← Usage limit, error handler
    ├── controllers/        ← Tool controller
    ├── routes/             ← API routes
    ├── models/             ← MongoDB models
    └── server.js           ← Entry point
```
