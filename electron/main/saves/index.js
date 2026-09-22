const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const dbService = require('../database');

// We use a fixed default or from settings, but for now fallback to D:/Arcadia/SaveBackups
const getBackupRoot = () => {
  return dbService.getSetting('backup_directory', 'D:/Arcadia/SaveBackups');
};

async function copyDir(src, dest, mode = 'replace') {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, mode);
    } else {
      if (fs.existsSync(destPath)) {
        if (mode === 'skip') continue;
        // if mode is replace or backup_then_replace, we just copy. 
        // backup_then_replace should backup the DEST before calling this function.
      }
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

async function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (let e of entries) {
    if (e.isDirectory()) count += await countFiles(path.join(dir, e.name));
    else count++;
  }
  return count;
}

class SaveManager {
  
  async getSaveStatus(gameId) {
    const game = dbService.getGameById(gameId);
    if (!game) throw new Error('Game not found');

    const status = {
      gameId: game.id,
      name: game.display_name,
      platform: game.platform,
      emulatorId: game.emulator_id,
      savePath: game.save_path || '',
      exists: false,
      fileCount: 0
    };

    if (status.savePath) {
      status.exists = fs.existsSync(status.savePath);
      if (status.exists) {
        status.fileCount = await countFiles(status.savePath);
      }
    }

    return status;
  }

  async getAllSaveStatuses() {
    const games = dbService.getAllGames().filter(g => g.save_path);
    const results = [];
    for (const g of games) {
      try {
        results.push(await this.getSaveStatus(g.id));
      } catch (err) {}
    }
    return results;
  }

  async backupSave(gameId, isManual = true) {
    const game = dbService.getGameById(gameId);
    if (!game || !game.save_path) return { success: false, error: 'No save path configured' };
    if (!fs.existsSync(game.save_path)) return { success: false, error: 'Save path does not exist' };
    
    // Check if it's actually empty
    const count = await countFiles(game.save_path);
    if (count === 0) return { success: false, error: 'Save directory is empty' };

    const backupRoot = getBackupRoot();
    const gameSafeName = game.display_name.replace(/[^a-z0-9]/gi, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupType = isManual ? 'manual' : 'auto';
    const destDir = path.join(backupRoot, gameSafeName, `${timestamp}_${backupType}`);

    try {
      await copyDir(game.save_path, destDir, 'replace');
      return { success: true, dest: destDir, files: count };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async getBackupHistory(gameId) {
    const game = dbService.getGameById(gameId);
    if (!game) return [];
    
    const backupRoot = getBackupRoot();
    const gameSafeName = game.display_name.replace(/[^a-z0-9]/gi, '_');
    const gameBackupDir = path.join(backupRoot, gameSafeName);

    if (!fs.existsSync(gameBackupDir)) return [];

    const entries = fs.readdirSync(gameBackupDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => {
        const fullPath = path.join(gameBackupDir, e.name);
        const stat = fs.statSync(fullPath);
        return {
          name: e.name,
          path: fullPath,
          date: stat.mtime
        };
      })
      .sort((a, b) => b.date - a.date);
  }

  async openBackupFolder(gameId) {
    const game = dbService.getGameById(gameId);
    if (!game) return { success: false };
    const gameSafeName = game.display_name.replace(/[^a-z0-9]/gi, '_');
    const p = path.join(getBackupRoot(), gameSafeName);
    
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    
    shell.openPath(p);
    return { success: true };
  }

  async populateSave(gameId, mode = 'replace') {
    const game = dbService.getGameById(gameId);
    if (!game || !game.save_path) return { success: false, error: 'No save path' };
    
    // 1. Appropriate save source:
    // First check if there's a backup.
    const history = await this.getBackupHistory(gameId);
    let sourceDir = '';

    if (history.length > 0) {
      sourceDir = history[0].path;
    } else {
      // Fallback: check source_dir/saves
      const localSaves = path.join(game.source_dir, 'saves');
      if (fs.existsSync(localSaves)) {
        sourceDir = localSaves;
      } else {
        const localSave = path.join(game.source_dir, 'save');
        if (fs.existsSync(localSave)) sourceDir = localSave;
      }
    }

    if (!sourceDir) return { success: false, error: 'No save source found (no backups or local save folder)' };

    // Overwrite Protection
    if (mode === 'backup_then_replace') {
      await this.backupSave(gameId, true);
    }

    try {
      await copyDir(sourceDir, game.save_path, mode === 'backup_then_replace' ? 'replace' : mode);
      return { success: true, source: sourceDir, dest: game.save_path };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async populateAllSaves(mode = 'replace') {
    const games = dbService.getAllGames().filter(g => g.save_path);
    const results = { total: games.length, success: 0, failed: 0, details: [] };
    
    for (const g of games) {
      const res = await this.populateSave(g.id, mode);
      if (res.success) results.success++;
      else results.failed++;
      results.details.push({ game: g.display_name, result: res });
    }
    return results;
  }
}

module.exports = new SaveManager();
