const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  // List capturable screens and windows
  getSources: (types) => ipcRenderer.invoke('get-sources', types),

  // Recording lifecycle — chunks streamed to disk in main process
  recordingStart:   ()          => ipcRenderer.invoke('recording-start'),
  recordingChunk:   (uint8arr)  => ipcRenderer.invoke('recording-chunk', uint8arr),

  // Stop + save dialog (choose format)
  recordingStopWebm: () => ipcRenderer.invoke('recording-stop-webm'),
  recordingStopMp4:  () => ipcRenderer.invoke('recording-stop-mp4'),

  // Discard without saving
  recordingDiscard: () => ipcRenderer.invoke('recording-discard'),

  // Open folder containing saved file
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),

  // Subscribe to MP4 conversion progress (0–99)
  onMp4Progress: (cb) => {
    const handler = (_, pct) => cb(pct);
    ipcRenderer.on('mp4-progress', handler);
    // Return an unsubscribe function
    return () => ipcRenderer.removeListener('mp4-progress', handler);
  },

  // Platform info
  platform: process.platform,
});
