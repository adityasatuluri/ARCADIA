const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arcadiaAPI', {
  system: {
    ping: () => ipcRenderer.invoke('system:ping')
  },
  games: {
    getAll: () => ipcRenderer.invoke('games:get-all'),
    upsert: (game) => ipcRenderer.invoke('games:upsert', game),
    toggleFavorite: (id) => ipcRenderer.invoke('games:toggle-favorite', id)
  },
  emulators: {
    getAll: () => ipcRenderer.invoke('emulators:get-all'),
    upsert: (emulator) => ipcRenderer.invoke('emulators:upsert', emulator)
  },
  scanner: {
    start: (targetPath) => ipcRenderer.invoke('scanner:start', targetPath),
    cancel: () => ipcRenderer.invoke('scanner:cancel'),
    onProgress: (callback) => {
      ipcRenderer.on('scanner:progress', (event, data) => callback(data));
    }
  },
  settings: {
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value)
  }
});

console.log('[Preload] arcadiaAPI exposed');
