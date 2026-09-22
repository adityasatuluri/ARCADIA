const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arcadiaAPI', {
  system: {
    ping: () => ipcRenderer.invoke('system:ping')
  }
});

console.log('[Preload] arcadiaAPI exposed');
