const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');
const dbService = require('../database/index.js');
const scannerService = require('../scanner/index.js');

class MaintenanceService {
  async rebuildDatabase() {
    try {
      dbService.db.run('DELETE FROM games');
      dbService.db.run('DELETE FROM emulators');
      dbService.persist();
      
      const libraryPaths = dbService.getSetting('library_locations', []);
      if (libraryPaths.length > 0) {
        return await scannerService.scanLibraries(libraryPaths);
      }
      return { success: true, message: 'Database rebuilt successfully (Empty).' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async rebuildArtworkCache() {
    try {
      // In a real robust system, this might clear a specific artwork cache folder.
      // We don't have a dedicated artwork crawler yet, so this is a placeholder stub
      // for future implementation as specified.
      const cacheDir = path.join(app.getPath('userData'), 'cache', 'artwork');
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async runDiagnostics() {
    try {
      const games = dbService.getAllGames();
      const emulators = dbService.getAllEmulators();
      
      const report = {
        totalGames: games.length,
        totalEmulators: emulators.length,
        invalidGames: 0,
        invalidEmulators: 0,
        invalidSaves: 0,
        warnings: []
      };

      for (const game of games) {
        if (game.type === 'pc' && (!game.executable || !fs.existsSync(game.executable))) {
          report.invalidGames++;
          report.warnings.push(`Game [${game.display_name}] executable not found.`);
        }
        if (game.type === 'emulator' && game.game_path && !fs.existsSync(game.game_path)) {
          report.invalidGames++;
          report.warnings.push(`Game [${game.display_name}] ROM/ISO not found.`);
        }
        if (game.save_path && !fs.existsSync(game.save_path) && !fs.existsSync(path.dirname(game.save_path))) {
          report.invalidSaves++;
          report.warnings.push(`Game [${game.display_name}] save directory does not exist.`);
        }
      }

      for (const emu of emulators) {
        if (!emu.executable || !fs.existsSync(emu.executable)) {
          report.invalidEmulators++;
          report.warnings.push(`Emulator [${emu.display_name}] executable not found.`);
        }
      }

      return { success: true, data: report };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async exportConfig(targetPath) {
    try {
      if (!targetPath) return { success: false, error: 'No path specified.' };
      const config = dbService.getAllSettings();
      fs.writeFileSync(targetPath, JSON.stringify(config, null, 2));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async importConfig(sourcePath) {
    try {
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        return { success: false, error: 'File not found.' };
      }
      const data = fs.readFileSync(sourcePath, 'utf8');
      const config = JSON.parse(data);
      for (const key of Object.keys(config)) {
        dbService.setSetting(key, config[key]);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async resetSettings() {
    try {
      dbService.db.run('DELETE FROM settings');
      dbService.persist();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  openDataFolder() {
    const dataPath = app.getPath('userData');
    shell.openPath(dataPath);
    return { success: true, data: dataPath };
  }
}

module.exports = new MaintenanceService();
