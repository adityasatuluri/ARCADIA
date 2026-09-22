const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 720,
      title: 'Arcadia',
      backgroundColor: '#0a0e17',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        sandbox: false,
        webSecurity: false // Allow file:// protocol for local artwork images
      }
    });

    const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

    if (isDev) {
      mainWindow.loadURL('http://localhost:5173');
    } else {
      mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
    }

    mainWindow.on('closed', () => { mainWindow = null; });
  }

  app.whenReady().then(async () => {
    // Initialize services
    try {
      const userDataPath = app.getPath('userData');
      const dbService = require('./database/index.js');
      await dbService.init(userDataPath);
      console.log('[Main] Services initialized.');
    } catch (err) {
      console.error('[Main] Init failed:', err);
    }

    // Register IPC
    const { registerIpcHandlers } = require('./ipc/index.js');
    registerIpcHandlers();

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
