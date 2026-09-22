const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');
const dbService = require('../database/index.js');

const GAME_EXTENSIONS = new Set([
  '.iso', '.cso', '.bin', '.cue', '.chd', '.rvz', '.gcm', '.wbfs',
  '.nes', '.snes', '.smc', '.sfc', '.gba', '.gbc', '.gb', '.nds',
  '.n64', '.z64', '.rom', '.pkg', '.xbe', '.xex'
]);

class ScannerService {
  constructor() {
    this.isScanning = false;
    this.cancelRequested = false;
    this.stats = { filesDiscovered: 0, gamesDiscovered: 0, emulatorsDiscovered: 0, currentLocation: '' };
  }

  _emit() {
    try {
      const win = BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) {
        win.webContents.send('scanner:progress', { ...this.stats });
      }
    } catch {}
  }

  async scanDirectory(targetPath) {
    if (this.isScanning) return { success: false, error: 'Already scanning' };

    this.isScanning = true;
    this.cancelRequested = false;
    this.stats = { filesDiscovered: 0, gamesDiscovered: 0, emulatorsDiscovered: 0, currentLocation: targetPath };
    this._emit();

    try {
      await this._crawl(targetPath);
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

    // Check for config.json in this directory
    let configData = null;
    let gameFiles = [];
    let iconFile = null;

    for (const e of entries) {
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

    if (this.stats.filesDiscovered % 25 === 0) this._emit();

    // Process config.json if found
    if (configData) {
      const isEmulator = configData.executable || (configData.tags && configData.tags.some(t =>
        t.toLowerCase() === 'emulator'));

      if (isEmulator) {
        this._registerEmulator(configData, dir, iconFile);
      } else {
        this._registerGame(configData, dir, iconFile, gameFiles);
      }
    } else if (gameFiles.length > 0) {
      // Auto-generate entries for loose game files (no config.json)
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

    // Recurse into subdirectories
    for (const e of entries) {
      if (e.isDirectory()) {
        await new Promise(r => setTimeout(r, 0)); // yield to event loop
        await this._crawl(path.join(dir, e.name));
      }
    }
  }

  _registerEmulator(cfg, dir, defaultIcon) {
    const exe = cfg.executable && !path.isAbsolute(cfg.executable)
      ? path.join(dir, cfg.executable) : (cfg.executable || '');
    const icon = cfg.icon && !path.isAbsolute(cfg.icon)
      ? path.join(dir, cfg.icon) : (cfg.icon || defaultIcon || '');

    dbService.upsertEmulator({
      id: cfg.name || path.basename(dir),
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
    const id = cfg.name || path.basename(dir).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const icon = cfg.icon && !path.isAbsolute(cfg.icon)
      ? path.join(dir, cfg.icon) : (cfg.icon || defaultIcon || '');
    const gamePath = gameFiles.length > 0 ? path.join(dir, gameFiles[0]) : '';

    // Try to determine emulator from the parent folder structure
    // e.g. Z:\gaming\games\xemu\Half-Life 2 → emulator hint is 'xemu'
    const parentFolder = path.basename(path.dirname(dir)).toLowerCase();

    dbService.upsertGame({
      id,
      name: cfg.name || id,
      display_name: cfg.display_name || path.basename(dir),
      type: 'emulator',
      platform: cfg.platform || 'Unknown',
      game_path: gamePath,
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
}

module.exports = new ScannerService();
