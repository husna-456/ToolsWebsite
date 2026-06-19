/**
 * Downloads Puppeteer's bundled Chrome to server/.cache/puppeteer
 * using an absolute path derived from __dirname so the install location
 * is identical regardless of how $HOME or CWD is set on the host.
 *
 * Run automatically via root package.json postinstall:
 *   "postinstall": "cd server && npm install && node install-chrome.js"
 */
const { execSync } = require('child_process');
const path = require('path');

const cacheDir = path.join(__dirname, '.cache', 'puppeteer');
console.log('[install-chrome] cache dir:', cacheDir);

try {
  // Use the puppeteer CLI installed locally in server/node_modules
  execSync('node_modules/.bin/puppeteer browsers install chrome', {
    cwd: __dirname,
    env: { ...process.env, PUPPETEER_CACHE_DIR: cacheDir },
    stdio: 'inherit',
  });
  console.log('[install-chrome] Chrome installed successfully.');
} catch (err) {
  // Non-fatal: the app will still try system Chromium as a fallback.
  // On Windows (local dev) this command may not work; set CHROME_BIN instead.
  console.error('[install-chrome] Chrome install failed (non-fatal):', err.message);
}
