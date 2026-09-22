const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arcadiaAPI', {
  system: {
    ping: () => ipcRenderer.invoke('system:ping'),
    showOpenDialog: (options) => ipcRenderer.invoke('system:show-open-dialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('system:show-save-dialog', options),
    openDataFolder: () => ipcRenderer.invoke('system:open-data-folder'),
    exportConfig: (targetPath) => ipcRenderer.invoke('system:export-config', targetPath),
    importConfig: (sourcePath) => ipcRenderer.invoke('system:import-config', sourcePath),
    resetSettings: () => ipcRenderer.invoke('system:reset-settings'),
    setFullscreen: (val) => ipcRenderer.invoke('system:set-fullscreen', val)
  },
  maintenance: {
    rebuildDatabase: () => ipcRenderer.invoke('maintenance:rebuild-database'),
    rebuildArtwork: () => ipcRenderer.invoke('maintenance:rebuild-artwork'),
    runDiagnostics: () => ipcRenderer.invoke('maintenance:run-diagnostics')
  },
  launcher: {
    launch: (gameId) => ipcRenderer.invoke('launcher:launch', gameId),
    launchEmulator: (emuId) => ipcRenderer.invoke('launcher:launch-emulator', emuId)
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
    start: (targetPaths) => ipcRenderer.invoke('scanner:start', targetPaths),
    cancel: () => ipcRenderer.invoke('scanner:cancel'),
    onProgress: (cb) => {
      const listener = (_, data) => cb(data);
      ipcRenderer.on('scanner:progress', listener);
      return () => ipcRenderer.removeListener('scanner:progress', listener);
    }
  },
  settings: {
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value)
  },
  saves: {
    getStatus: (id) => ipcRenderer.invoke('saves:get-status', id),
    getAllStatuses: () => ipcRenderer.invoke('saves:get-all-statuses'),
    backup: (id) => ipcRenderer.invoke('saves:backup', id),
    getHistory: (id) => ipcRenderer.invoke('saves:get-history', id),
    openFolder: (id) => ipcRenderer.invoke('saves:open-folder', id),
    populate: (id, mode) => ipcRenderer.invoke('saves:populate', id, mode),
    populateAll: (mode) => ipcRenderer.invoke('saves:populate-all', mode)
  }
});

console.log('[Preload] arcadiaAPI exposed');
