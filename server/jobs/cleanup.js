const cron = require('node-cron');
const fs   = require('fs');
const path = require('path');
const { TMP_DIR } = require('../middleware/upload');

const ONE_HOUR = 60 * 60 * 1000;

function purgeOldFiles() {
  if (!fs.existsSync(TMP_DIR)) return;

  fs.readdir(TMP_DIR, (err, files) => {
    if (err) return;
    const now = Date.now();
    for (const file of files) {
      const fp = path.join(TMP_DIR, file);
      fs.stat(fp, (statErr, stats) => {
        if (statErr) return;
        if (now - stats.mtimeMs > ONE_HOUR) {
          fs.unlink(fp, () => {});
        }
      });
    }
  });
}

// Run at the top of every hour
cron.schedule('0 * * * *', purgeOldFiles);

module.exports = { purgeOldFiles };
