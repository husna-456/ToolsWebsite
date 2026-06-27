const { app, BrowserWindow, ipcMain, dialog, desktopCapturer, shell } = require('electron');
const path  = require('path');
const fs    = require('fs');
const os    = require('os');

const isDev = process.env.NODE_ENV === 'development';

// ── ffmpeg path: works in dev and in packaged app (.asar.unpacked) ──
const ffmpegBin = require('ffmpeg-static');
const ffmpegPath = app.isPackaged
  ? ffmpegBin.replace('app.asar', 'app.asar.unpacked')
  : ffmpegBin;

// Lazy-load fluent-ffmpeg so the path can be set before it initialises
let fluentFfmpeg = null;
function getFfmpeg() {
  if (!fluentFfmpeg) {
    fluentFfmpeg = require('fluent-ffmpeg');
    fluentFfmpeg.setFfmpegPath(ffmpegPath);
  }
  return fluentFfmpeg;
}

// ── Per-recording temp state ──────────────────────────────────────
let tempWriteStream = null;
let tempWebmPath    = null;
let recordStartMs   = 0;

// ── Window ────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width:  1020,
    height: 740,
    minWidth:  820,
    minHeight: 600,
    title: 'GTT Screen Recorder',
    backgroundColor: '#0a0a12',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,      // needed for desktopCapturer in getUserMedia
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5174');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC: get screen/window sources ───────────────────────────────
ipcMain.handle('get-sources', async (_, types = ['screen', 'window']) => {
  const sources = await desktopCapturer.getSources({
    types,
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  });
  // Serialise NativeImage → data URL for the renderer
  return sources.map(s => ({
    id:        s.id,
    name:      s.name,
    thumbnail: s.thumbnail.toDataURL(),
    appIcon:   s.appIcon ? s.appIcon.toDataURL() : null,
  }));
});

// ── IPC: start streaming chunks to a temp file ───────────────────
ipcMain.handle('recording-start', async () => {
  const tmpDir = path.join(os.tmpdir(), 'gtt-recorder');
  fs.mkdirSync(tmpDir, { recursive: true });
  tempWebmPath    = path.join(tmpDir, `rec-${Date.now()}.webm`);
  tempWriteStream = fs.createWriteStream(tempWebmPath);
  recordStartMs   = Date.now();
  return tempWebmPath;
});

// Called every ~1 s as MediaRecorder fires ondataavailable
ipcMain.handle('recording-chunk', async (_, uint8) => {
  if (tempWriteStream?.writable) {
    tempWriteStream.write(Buffer.from(uint8));
  }
});

// ── IPC: finalize WebM — close stream, save dialog ───────────────
ipcMain.handle('recording-stop-webm', async (event) => {
  if (!tempWriteStream) return { error: 'No active recording' };

  await new Promise((resolve) => {
    tempWriteStream.end(resolve);
    tempWriteStream = null;
  });

  const { filePath, canceled } = await dialog.showSaveDialog({
    title:       'Save Recording as WebM',
    defaultPath: path.join(os.homedir(), 'Videos', `recording-${dateSlug()}.webm`),
    filters:     [{ name: 'WebM Video', extensions: ['webm'] }],
  });

  if (canceled || !filePath) return { canceled: true };

  fs.copyFileSync(tempWebmPath, filePath);
  cleanupTemp();
  return { saved: true, path: filePath };
});

// ── IPC: convert temp WebM → MP4, save dialog ────────────────────
ipcMain.handle('recording-stop-mp4', async (event) => {
  if (!tempWriteStream) return { error: 'No active recording' };

  await new Promise((resolve) => {
    tempWriteStream.end(resolve);
    tempWriteStream = null;
  });

  if (!fs.existsSync(tempWebmPath) || fs.statSync(tempWebmPath).size === 0) {
    return { error: 'Recording file is empty.' };
  }

  const { filePath, canceled } = await dialog.showSaveDialog({
    title:       'Save Recording as MP4',
    defaultPath: path.join(os.homedir(), 'Videos', `recording-${dateSlug()}.mp4`),
    filters:     [{ name: 'MP4 Video', extensions: ['mp4'] }],
  });

  if (canceled || !filePath) return { canceled: true };

  const tempMp4 = tempWebmPath.replace('.webm', '.mp4');

  return new Promise((resolve) => {
    getFfmpeg()(tempWebmPath)
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
      ])
      .output(tempMp4)
      .on('progress', (info) => {
        // Send progress percentage back to renderer
        event.sender.send('mp4-progress', Math.min(99, Math.round(info.percent || 0)));
      })
      .on('end', () => {
        fs.copyFileSync(tempMp4, filePath);
        cleanupTemp(tempMp4);
        resolve({ saved: true, path: filePath });
      })
      .on('error', (err) => {
        cleanupTemp(tempMp4);
        resolve({ error: err.message });
      })
      .run();
  });
});

// ── IPC: discard temp recording ───────────────────────────────────
ipcMain.handle('recording-discard', async () => {
  if (tempWriteStream) { tempWriteStream.destroy(); tempWriteStream = null; }
  cleanupTemp();
  return { ok: true };
});

// ── IPC: open saved file in OS file manager ───────────────────────
ipcMain.handle('show-in-folder', async (_, filePath) => {
  shell.showItemInFolder(filePath);
});

// ── Helpers ───────────────────────────────────────────────────────
function cleanupTemp(extraPath) {
  try { if (tempWebmPath && fs.existsSync(tempWebmPath)) fs.unlinkSync(tempWebmPath); } catch {}
  try { if (extraPath    && fs.existsSync(extraPath))    fs.unlinkSync(extraPath);    } catch {}
  tempWebmPath = null;
}

function dateSlug() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}
