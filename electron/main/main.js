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
      fullscreen: global.startupFullscreen !== undefined ? global.startupFullscreen : true,
      autoHideMenuBar: true,
      title: 'Arcadia',
      backgroundColor: '#0a0e17',
      icon: path.join(__dirname, '..', '..', 'assets', 'app_icon.png'),
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
    // === PORTABLE MODE: Detect drive letter ===
    const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
    let dataDir;
    let driveLetter;

    if (isDev) {
      // In dev mode, use the project directory's drive
      driveLetter = path.parse(__dirname).root; // e.g. "D:\"
      dataDir = app.getPath('userData'); // Use standard Electron path for dev
    } else {
      // In production (packaged)
      // For NSIS portable builds, app.getPath('exe') points to a Temp folder on C:
      // We must use PORTABLE_EXECUTABLE_DIR if it exists
      const originalExeDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
      driveLetter = path.parse(originalExeDir).root; // e.g. "Z:\"
      dataDir = path.join(driveLetter, 'ArcadiaData');
    }

    // Store drive letter globally so database service can use it for path resolution
    global.arcadiaDrive = driveLetter;
    console.log(`[Main] Portable mode — Drive: ${driveLetter}, Data: ${dataDir}`);

    // Initialize services
    let isFullscreen = true;
    try {
      const dbService = require('./database/index.js');
      await dbService.init(dataDir);

      // Auto-set library path on first boot
      const libs = dbService.getSetting('library_locations');
      if (!libs || (Array.isArray(libs) && libs.length === 0)) {
        const gamingPath = path.join(driveLetter, 'gaming');
        dbService.setSetting('library_locations', [gamingPath]);
        console.log(`[Main] Auto-set library path: ${gamingPath}`);
      }

      // Read fullscreen preference
      const fsSetting = dbService.getSetting('fullscreen');
      if (fsSetting !== undefined && fsSetting !== null) {
        if (typeof fsSetting === 'string') {
          isFullscreen = fsSetting === 'true';
        } else {
          isFullscreen = !!fsSetting;
        }
      }

      console.log('[Main] Services initialized.');
    } catch (err) {
      console.error('[Main] Init failed:', err);
    }

    global.startupFullscreen = isFullscreen;

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
