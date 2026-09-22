const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');
const dbService = require('../database/index.js');

const GAME_EXTENSIONS = new Set([
  '.iso', '.cso', '.bin', '.cue', '.chd', '.rvz', '.gcm', '.wbfs',
  '.nes', '.snes', '.smc', '.sfc', '.gba', '.gbc', '.gb', '.nds',
  '.n64', '.z64', '.rom', '.pkg', '.xbe', '.xex'
]);

const IGNORED_DIRS = new Set(['node_modules', '.git', '.vscode', '.idea', 'AppData', 'System32']);

class ScannerService {
  constructor() {
    this.isScanning = false;
    this.cancelRequested = false;
    this.stats = { filesDiscovered: 0, gamesDiscovered: 0, emulatorsDiscovered: 0, currentLocation: '', phase: 'idle' };
    this.discoveredGameIds = new Set();
    this.discoveredEmulatorIds = new Set();
  }

  _emit() {
    try {
      const win = BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) {
        win.webContents.send('scanner:progress', { ...this.stats });
      }
    } catch {}
  }

  async scanLibraries(targetPaths) {
    if (this.isScanning) return { success: false, error: 'Already scanning' };

    this.isScanning = true;
    this.cancelRequested = false;
    this.stats = { filesDiscovered: 0, gamesDiscovered: 0, emulatorsDiscovered: 0, currentLocation: '', phase: 'scanning' };
    this.discoveredGameIds.clear();
    this.discoveredEmulatorIds.clear();
    this._emit();

    try {
      for (const dir of targetPaths) {
        if (this.cancelRequested) break;
        if (!fs.existsSync(dir)) continue;
        await this._crawl(dir);
      }

      if (!this.cancelRequested) {
        this.stats.phase = 'cleanup';
        this._emit();
        this._detectMissing();
      }

      this.stats.phase = 'complete';
      this._emit();
      return { success: true, stats: { ...this.stats } };
    } catch (err) {
      console.error('[Scanner] Failed:', err);
      return { success: false, error: err.message };
    } finally {
      this.isScanning = false;
    }
  }

  cancelScan() { this.cancelRequested = true; }

  async _crawl(dir) {
    if (this.cancelRequested) return;
    this.stats.currentLocation = dir;

    let entries;
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); }
    catch { return; }

    let configData = null;
    let gameFiles = [];
    let iconFile = null;

    for (const e of entries) {
      if (this.cancelRequested) return;
      if (!e.isFile()) continue;
      this.stats.filesDiscovered++;
      const name = e.name.toLowerCase();
      const ext = path.extname(name);

      if (name === 'config.json') {
        try {
          const raw = await fs.promises.readFile(path.join(dir, e.name), 'utf-8');
          configData = JSON.parse(raw);
        } catch {}
      } else if (GAME_EXTENSIONS.has(ext)) {
        gameFiles.push(e.name);
      } else if (name === 'icon.png' || name === 'icon.jpg' || name === 'icon.jpeg') {
        iconFile = path.join(dir, e.name);
      }
    }

    if (this.stats.filesDiscovered % 50 === 0) this._emit();

    if (configData) {
      const isEmulator = configData.executable || (configData.tags && configData.tags.some(t =>
        t.toLowerCase() === 'emulator'));

      if (isEmulator) {
        this._registerEmulator(configData, dir, iconFile);
      } else {
        this._registerGame(configData, dir, iconFile, gameFiles);
      }
    } else if (gameFiles.length > 0) {
      for (const gf of gameFiles) {
        const gameName = path.basename(gf, path.extname(gf));
        const parentName = path.basename(dir);
        this._registerGame({
          name: gameName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          display_name: gameName,
          platform: parentName
        }, dir, iconFile, [gf]);
      }
    }

    for (const e of entries) {
      if (this.cancelRequested) return;
      if (e.isDirectory() && !IGNORED_DIRS.has(e.name) && !e.name.startsWith('.')) {
        await new Promise(r => setTimeout(r, 0));
        await this._crawl(path.join(dir, e.name));
      }
    }
  }

  _registerEmulator(cfg, dir, defaultIcon) {
    const exe = cfg.executable && !path.isAbsolute(cfg.executable)
      ? path.join(dir, cfg.executable) : (cfg.executable || '');
    const icon = cfg.icon && !path.isAbsolute(cfg.icon)
      ? path.join(dir, cfg.icon) : (cfg.icon || defaultIcon || '');

    const id = cfg.name || path.basename(dir).toLowerCase();
    this.discoveredEmulatorIds.add(id);

    dbService.upsertEmulator({
      id: id,
      name: cfg.name || path.basename(dir),
      display_name: cfg.display_name || cfg.name || path.basename(dir),
      platform: cfg.platform || 'Unknown',
      executable: exe,
      working_directory: cfg.working_directory === '.' ? dir : (cfg.working_directory || dir),
      arguments: cfg.arguments || '',
      icon_path: icon,
      description: cfg.description || '',
      version: cfg.version || '',
      developer: cfg.developer || '',
      tags: cfg.tags || [],
      is_default: true,
      notes: cfg.notes || ''
    });
    this.stats.emulatorsDiscovered++;
  }

  _registerGame(cfg, dir, defaultIcon, gameFiles) {
    let id = cfg.name || path.basename(dir).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Prevent duplicate IDs across libraries (append dir hash if needed, but for now fallback to simple dedupe)
    if (this.discoveredGameIds.has(id)) {
       id = id + '-' + Math.random().toString(36).substr(2, 5);
    }
    
    this.discoveredGameIds.add(id);

    const icon = cfg.icon && !path.isAbsolute(cfg.icon)
      ? path.join(dir, cfg.icon) : (cfg.icon || defaultIcon || '');
    const gamePath = gameFiles.length > 0 ? path.join(dir, gameFiles[0]) : '';

    const parentFolder = path.basename(path.dirname(dir)).toLowerCase();

    dbService.upsertGame({
      id,
      name: cfg.name || id,
      display_name: cfg.display_name || path.basename(dir),
      type: cfg.executable ? 'pc' : 'emulator',
      platform: cfg.platform || 'Unknown',
      game_path: gamePath,
      executable: cfg.executable || '',
      arguments: cfg.arguments || '',
      working_directory: cfg.working_directory || '',
      icon_path: icon,
      description: cfg.description || '',
      year: cfg.year || null,
      genre: cfg.genre || [],
      developer: cfg.developer || '',
      publisher: cfg.publisher || '',
      tags: cfg.tags || [],
      favorite: cfg.favorite || false,
      notes: cfg.notes || '',
      emulator_id: parentFolder || '',
      source_dir: dir
    });
    this.stats.gamesDiscovered++;
  }

  _detectMissing() {
    // Only detect missing games if we successfully completed a scan
    const allGames = dbService.getAllGames();
    for (const game of allGames) {
      if (game.source_dir && !this.discoveredGameIds.has(game.id)) {
        // The game came from a scan but wasn't found in this run.
        // Let's verify if the physical directory is gone before removing
        if (!fs.existsSync(game.source_dir)) {
          console.log(`[Scanner] Removing missing game: ${game.display_name}`);
          dbService.removeGame(game.id);
        }
      }
    }
  }
}

module.exports = new ScannerService();
