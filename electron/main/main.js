const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Prevent multiple instances
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
      backgroundColor: '#000000', // Console-style dark background
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        sandbox: false // Sandbox false may be required if preload needs specific IPC or electron features, though contextIsolation is true
      }
    });

    // In development mode, Vite runs on port 5173
    const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
    
    if (isDev) {
      mainWindow.loadURL('http://localhost:5173');
      // mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(async () => {
    // Initialize backend services
    try {
      const userDataPath = app.getPath('userData');
      const dbService = require('./database/index.js');
      const configService = require('./services/config.js');
      
      await dbService.init(userDataPath);
      configService.init(userDataPath);
      console.log('[Main] Services initialized successfully.');
    } catch (err) {
      console.error('[Main] Failed to initialize services:', err);
    }

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Secure IPC Foundation Example
  ipcMain.handle('system:ping', () => {
    return 'pong-from-main';
  });
}
