const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arcadiaAPI', {
  system: {
    ping: () => ipcRenderer.invoke('system:ping'),
    showOpenDialog: (options) => ipcRenderer.invoke('system:show-open-dialog', options)
  },
  launcher: {
    launch: (gameId) => ipcRenderer.invoke('launcher:launch', gameId)
  },
  games: {
    getAll: () => ipcRenderer.invoke('games:get-all'),
    get: (id) => ipcRenderer.invoke('games:get', id),
    upsert: (game) => ipcRenderer.invoke('games:upsert', game),
    toggleFavorite: (id) => ipcRenderer.invoke('games:toggle-favorite', id),
    remove: (id) => ipcRenderer.invoke('games:remove', id),
    recordLaunch: (id) => ipcRenderer.invoke('games:record-launch', id)
  },
  emulators: {
    getAll: () => ipcRenderer.invoke('emulators:get-all'),
    upsert: (emu) => ipcRenderer.invoke('emulators:upsert', emu),
    remove: (id) => ipcRenderer.invoke('emulators:remove', id),
    getGames: (emuId) => ipcRenderer.invoke('emulators:get-games', emuId),
    resolve: (platform) => ipcRenderer.invoke('emulators:resolve', platform)
  },
  scanner: {
    start: (targetPath) => ipcRenderer.invoke('scanner:start', targetPath),
    cancel: () => ipcRenderer.invoke('scanner:cancel'),
    onProgress: (cb) => ipcRenderer.on('scanner:progress', (_, data) => cb(data))
  },
  settings: {
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value)
  }
});

console.log('[Preload] arcadiaAPI exposed');
