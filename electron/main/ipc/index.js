const { ipcMain, dialog, BrowserWindow } = require('electron');
const dbService = require('../database/index.js');
const scannerService = require('../scanner/index.js');
const launcherService = require('../launcher/index.js');
const savesService = require('../saves/index.js');

function registerIpcHandlers() {

  /* ======== SYSTEM ======== */
  ipcMain.handle('system:ping', () => 'pong-from-main');
  
  ipcMain.handle('system:show-open-dialog', async (event, options = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, options);
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
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
      
      const fs = require('fs');
      const path = require('path');
      
      // Default working directory for PC games to the directory of executable if empty
      if (game.type === 'pc' && game.executable) {
        if (!game.working_directory || game.working_directory.trim() === '') {
          game.working_directory = path.dirname(game.executable);
        }
      }

      let sourceDir = game.source_dir;
      
      // If no source_dir is set (e.g. new game added via UI), infer it
      if (!sourceDir) {
        if (game.type === 'pc') {
          sourceDir = game.working_directory || (game.executable ? path.dirname(game.executable) : '');
        } else if (game.type === 'emulator' && game.game_path) {
          sourceDir = path.dirname(game.game_path);
        }
        
        if (sourceDir) {
          game.source_dir = sourceDir;
        }
      }
      
      if (sourceDir && fs.existsSync(sourceDir)) {
        // Copy icon and background to working/source directory for portability if they reside outside
        if (game.icon_path && fs.existsSync(game.icon_path)) {
          const iconExt = path.extname(game.icon_path) || '.png';
          const targetIconName = `icon${iconExt}`;
          const targetIconPath = path.join(sourceDir, targetIconName);
          
          if (path.resolve(game.icon_path).toLowerCase() !== path.resolve(targetIconPath).toLowerCase()) {
            try {
              fs.copyFileSync(game.icon_path, targetIconPath);
              game.icon_path = targetIconPath;
            } catch (copyErr) {
              console.error('Failed to copy icon to source directory:', copyErr);
            }
          }
        }

        if (game.background_path && fs.existsSync(game.background_path)) {
          const bgExt = path.extname(game.background_path) || '.jpg';
          const targetBgName = `background${bgExt}`;
          const targetBgPath = path.join(sourceDir, targetBgName);
          
          if (path.resolve(game.background_path).toLowerCase() !== path.resolve(targetBgPath).toLowerCase()) {
            try {
              fs.copyFileSync(game.background_path, targetBgPath);
              game.background_path = targetBgPath;
            } catch (copyErr) {
              console.error('Failed to copy background to source directory:', copyErr);
            }
          }
        }

        const configPath = path.join(sourceDir, 'config.json');
        let configData = {};
        
        if (fs.existsSync(configPath)) {
          try {
            configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          } catch (e) {
            console.error('Failed to parse existing config.json', e);
          }
        }
        
        // Merge UI fields into config.json with portable relative filenames where applicable
        configData.name = game.name || game.id;
        configData.display_name = game.display_name;
        configData.platform = game.platform || (game.type === 'pc' ? 'PC' : 'Unknown');
        if (game.type === 'pc' && game.executable) {
          // If executable is inside sourceDir, store relative filename for portability
          const relExe = path.relative(sourceDir, game.executable);
          configData.executable = (!relExe.startsWith('..') && !path.isAbsolute(relExe)) ? relExe : game.executable;
          if (game.arguments) configData.arguments = game.arguments;
          if (game.working_directory) {
            const relCwd = path.relative(sourceDir, game.working_directory);
            configData.working_directory = (relCwd === '' || relCwd === '.') ? '.' : game.working_directory;
          }
        }
        if (game.icon_path) {
          const relIcon = path.relative(sourceDir, game.icon_path);
          configData.icon = (!relIcon.startsWith('..') && !path.isAbsolute(relIcon)) ? relIcon : game.icon_path;
        }
        if (game.background_path) {
          const relBg = path.relative(sourceDir, game.background_path);
          configData.largecover = (!relBg.startsWith('..') && !path.isAbsolute(relBg)) ? relBg : game.background_path;
        }
        if (game.description) configData.description = game.description;
        if (game.year) configData.year = game.year;
        if (game.genre) {
          configData.genre = Array.isArray(game.genre) ? game.genre : game.genre.split(',').map(s=>s.trim()).filter(Boolean);
        }
        if (game.developer) configData.developer = game.developer;
        if (game.publisher) configData.publisher = game.publisher;
        if (game.tags) {
          configData.tags = Array.isArray(game.tags) ? game.tags : game.tags.split(',').map(s=>s.trim()).filter(Boolean);
        }
        if (game.favorite !== undefined) configData.favorite = game.favorite;
        if (game.notes) configData.notes = game.notes;
        
        if (game.save_path) {
          configData.save = configData.save || {};
          configData.save.path = game.save_path;
        }
        
        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
      }

      return { success: true, data: dbService.upsertGame(game) };
    } catch (e) { console.error(e); return { success: false, error: e.message }; }
  });

  ipcMain.handle('games:toggle-favorite', (_, id) => {
    try {
      const g = dbService.toggleFavorite(id);
      
      // Sync to config.json
      if (g && g.source_dir) {
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(g.source_dir, 'config.json');
        if (fs.existsSync(configPath)) {
          try {
            const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            configData.favorite = g.favorite;
            fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
          } catch (e) {
            console.error('Failed to update favorite in config.json', e);
          }
        }
      }
      
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

  ipcMain.handle('settings:get', (_, key) => {
    try { return { success: true, data: dbService.getSetting(key) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('settings:set', (_, key, value) => {
    try { dbService.setSetting(key, value); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  /* ======== SAVES ======== */
  ipcMain.handle('saves:get-status', async (_, id) => await savesService.getSaveStatus(id));
  ipcMain.handle('saves:get-all-statuses', async () => await savesService.getAllSaveStatuses());
  ipcMain.handle('saves:backup', async (_, id) => await savesService.backupSave(id, true));
  ipcMain.handle('saves:get-history', async (_, id) => await savesService.getBackupHistory(id));
  ipcMain.handle('saves:open-folder', async (_, id) => await savesService.openBackupFolder(id));
  ipcMain.handle('saves:populate', async (_, id, mode) => await savesService.populateSave(id, mode));
  ipcMain.handle('saves:populate-all', async (_, mode) => await savesService.populateAllSaves(mode));
}

module.exports = { registerIpcHandlers };
