const { ipcMain } = require('electron');
const dbService = require('../database/index.js');
const configService = require('../services/config.js');
const scannerService = require('../scanner/index.js');

function registerIpcHandlers() {
  // Scanner
  ipcMain.handle('scanner:start', async (event, targetPath) => {
    return await scannerService.scanDirectory(targetPath);
  });

  ipcMain.handle('scanner:cancel', () => {
    scannerService.cancelScan();
    return { success: true };
  });

  // Games
  ipcMain.handle('games:get-all', () => {
    try {
      return { success: true, data: dbService.getAllGames() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('games:upsert', (event, game) => {
    try {
      if (!game || !game.id) throw new Error("Invalid game record: missing id");
      
      // Update Database
      const updated = dbService.upsertGame(game);
      
      // Update JSON Config
      configService.saveGameConfigFile(updated);

      return { success: true, data: updated };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('games:toggle-favorite', (event, id) => {
    try {
      const updated = dbService.toggleFavorite(id);
      if (updated) {
        configService.saveGameConfigFile(updated);
        
        // Update favorites table
        if (updated.favorite) {
           dbService.db.run("INSERT OR REPLACE INTO favorites (game_id, added_at) VALUES (?, ?)", [id, new Date().toISOString()]);
        } else {
           dbService.db.run("DELETE FROM favorites WHERE game_id = ?", [id]);
        }
        dbService.persist();
      }
      return { success: true, data: updated };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Emulators
  ipcMain.handle('emulators:get-all', () => {
    try {
      return { success: true, data: dbService.getAllEmulators() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('emulators:upsert', (event, emulator) => {
    try {
      if (!emulator || !emulator.name) throw new Error("Invalid emulator record: missing name");
      
      const updated = dbService.upsertEmulator(emulator);
      configService.saveEmulatorConfigFile(updated);
      
      return { success: true, data: updated };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Settings
  ipcMain.handle('settings:get-all', () => {
    try {
      return { success: true, data: dbService.getAllSettings() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('settings:set', (event, key, value) => {
    try {
      dbService.setSetting(key, value);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerIpcHandlers };
