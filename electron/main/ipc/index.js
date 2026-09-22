const { ipcMain, dialog } = require('electron');
const dbService = require('../database/index.js');
const scannerService = require('../scanner/index.js');
const launcherService = require('../launcher/index.js');

function registerIpcHandlers() {

  /* ======== SYSTEM ======== */
  ipcMain.handle('system:ping', () => 'pong-from-main');
  
  ipcMain.handle('system:show-open-dialog', async (event, options = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, options);
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  /* ======== SETTINGS ======== */
  ipcMain.handle('settings:get-all', async () => {
    try {
      return { success: true, data: dbService.getAllSettings() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('settings:get', async (_, key) => {
    try {
      return { success: true, data: dbService.getSetting(key) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('settings:set', async (_, key, value) => {
    try {
      dbService.setSetting(key, value);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  /* ======== LAUNCHER ======== */
  ipcMain.handle('launcher:launch', async (event, gameId) => {
    try {
      const result = await launcherService.launch(gameId);
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('launcher:launch-emulator', async (event, emuId) => {
    try {
      const result = await launcherService.launchEmulator(emuId);
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  /* ======== SCANNER ======== */
  ipcMain.handle('scanner:start', async (_, targetPaths) => {
    return await scannerService.scanLibraries(targetPaths);
  });
  ipcMain.handle('scanner:cancel', () => {
    scannerService.cancelScan();
    return { success: true };
  });

  /* ======== GAMES ======== */
  ipcMain.handle('games:get-all', () => {
    try { return { success: true, data: dbService.getAllGames() }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('games:get', (_, id) => {
    try {
      const g = dbService.getGameById(id);
      return g ? { success: true, data: g } : { success: false, error: 'Not found' };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('games:upsert', (_, game) => {
    try {
      if (!game || !game.id) throw new Error('Invalid game: missing id');
      return { success: true, data: dbService.upsertGame(game) };
    } catch (e) { console.error(e); return { success: false, error: e.message }; }
  });

  ipcMain.handle('games:toggle-favorite', (_, id) => {
    try {
      const g = dbService.toggleFavorite(id);
      return { success: true, data: g };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('games:remove', (_, id) => {
    try { return { success: true, data: dbService.removeGame(id) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('games:record-launch', (_, id) => {
    try { dbService.recordGameLaunch(id); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  /* ======== EMULATORS ======== */
  ipcMain.handle('emulators:get-all', () => {
    try { return { success: true, data: dbService.getAllEmulators() }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('emulators:upsert', (_, emu) => {
    try {
      if (!emu || !emu.name) throw new Error('Invalid emulator: missing name');
      return { success: true, data: dbService.upsertEmulator(emu) };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('emulators:remove', (_, id) => {
    try { return { success: true, data: dbService.removeEmulator(id) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('emulators:get-games', (_, emuId) => {
    try { return { success: true, data: dbService.getGamesForEmulator(emuId) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('emulators:resolve', (_, platform) => {
    try {
      const emu = dbService.getDefaultEmulatorForPlatform(platform);
      return emu ? { success: true, data: emu } : { success: false, error: 'No emulator for platform: ' + platform };
    } catch (e) { return { success: false, error: e.message }; }
  });

  /* ======== SETTINGS ======== */
  ipcMain.handle('settings:get-all', () => {
    try { return { success: true, data: dbService.getAllSettings() }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('settings:set', (_, key, value) => {
    try { dbService.setSetting(key, value); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });
}

module.exports = { registerIpcHandlers };
