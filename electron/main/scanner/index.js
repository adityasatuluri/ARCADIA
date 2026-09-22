const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');
const dbService = require('../database/index.js');
const configService = require('../services/config.js');

const SUPPORTED_EXTENSIONS = new Set([
  '.iso', '.cso', '.bin', '.cue', '.chd', '.rom', '.nes', '.snes',
  '.smc', '.sfc', '.gba', '.gbc', '.gb', '.nds', '.n64', '.z64',
  '.rvz', '.gcm', '.wbfs', '.pkg', '.xbe', '.xex'
]);

class ScannerService {
  constructor() {
    this.isScanning = false;
    this.cancelRequested = false;
    this.stats = {
      filesDiscovered: 0,
      gamesDiscovered: 0,
      emulatorsDiscovered: 0,
      currentLocation: ''
    };
  }

  emitProgress() {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.send('scanner:progress', { ...this.stats });
    }
  }

  async scanDirectory(targetPath) {
    if (this.isScanning) return { success: false, error: 'Already scanning' };
    
    this.isScanning = true;
    this.cancelRequested = false;
    this.stats = { filesDiscovered: 0, gamesDiscovered: 0, emulatorsDiscovered: 0, currentLocation: targetPath };
    this.emitProgress();

    try {
      await this._crawl(targetPath);
      return { success: true, stats: this.stats };
    } catch (err) {
      console.error('[Scanner] Scan failed:', err);
      return { success: false, error: err.message };
    } finally {
      this.isScanning = false;
      this.emitProgress();
    }
  }

  cancelScan() {
    this.cancelRequested = true;
  }

  async _crawl(currentPath) {
    if (this.cancelRequested) return;

    this.stats.currentLocation = currentPath;
    if (this.stats.filesDiscovered % 10 === 0) this.emitProgress();

    let entries = [];
    try {
      entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
    } catch (err) {
      console.warn(`[Scanner] Cannot read directory: ${currentPath}`);
      return;
    }

    let hasConfig = false;
    let configData = null;
    let isoFiles = [];

    // First pass: identify config and game files in current directory
    for (const entry of entries) {
      if (entry.isFile()) {
        this.stats.filesDiscovered++;
        const ext = path.extname(entry.name).toLowerCase();
        
        if (entry.name.toLowerCase() === 'config.json') {
          hasConfig = true;
          try {
            const raw = await fs.promises.readFile(path.join(currentPath, entry.name), 'utf-8');
            configData = JSON.parse(raw);
          } catch (e) {
            console.warn(`[Scanner] Failed to parse config.json at ${currentPath}`);
          }
        } else if (SUPPORTED_EXTENSIONS.has(ext)) {
          isoFiles.push(entry.name);
        }
      }
    }

    // Process Config if present
    if (hasConfig && configData) {
      const isEmulator = (configData.tags && configData.tags.includes('Emulator')) || configData.executable;

      if (isEmulator) {
        // Process as Emulator
        const emu = { ...configData };
        if (emu.executable && !path.isAbsolute(emu.executable)) {
          emu.executable = path.join(currentPath, emu.executable);
        }
        if (emu.icon && !path.isAbsolute(emu.icon)) {
          emu.icon = path.join(currentPath, emu.icon);
        }
        emu.working_directory = currentPath;
        
        // Handle arguments format
        if (typeof emu.arguments === 'string') {
          emu.arguments = [emu.arguments];
        } else if (!Array.isArray(emu.arguments)) {
          emu.arguments = [];
        }

        dbService.upsertEmulator(emu);
        this.stats.emulatorsDiscovered++;
      } else {
        // Process as Game
        const game = { ...configData };
        if (!game.id) game.id = game.name || path.basename(currentPath).toLowerCase().replace(/\s+/g, '-');
        
        // Resolve Game Path if missing
        if (!game.game_path && isoFiles.length > 0) {
          game.game_path = path.join(currentPath, isoFiles[0]); // Default to first ISO found
        } else if (game.game_path && !path.isAbsolute(game.game_path)) {
          game.game_path = path.join(currentPath, game.game_path);
        }

        // Resolve Artwork
        game.artwork = game.artwork || {};
        if (game.icon && !path.isAbsolute(game.icon)) {
          game.artwork.icon = path.join(currentPath, game.icon);
        }
        
        dbService.upsertGame(game);
        this.stats.gamesDiscovered++;
      }
    } else if (isoFiles.length > 0) {
      // Found game files without config.json - Auto generate basic entry
      for (const iso of isoFiles) {
        const gameName = path.basename(iso, path.extname(iso));
        // Try to guess platform from parent folder name
        const parentFolder = path.basename(path.dirname(currentPath));
        const currentFolder = path.basename(currentPath);
        const guessedPlatform = ['ps2', 'xbox', 'wii', 'gamecube', 'psp', 'ps1', 'ps3'].includes(parentFolder.toLowerCase()) 
          ? parentFolder 
          : currentFolder;

        const game = {
          id: gameName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name: gameName,
          display_name: gameName,
          type: 'emulator',
          platform: guessedPlatform,
          game_path: path.join(currentPath, iso)
        };
        dbService.upsertGame(game);
        this.stats.gamesDiscovered++;
      }
    }

    // Recursively crawl subdirectories (yielding to event loop to keep UI responsive)
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await new Promise(r => setTimeout(r, 0)); 
        await this._crawl(path.join(currentPath, entry.name));
      }
    }
  }
}

module.exports = new ScannerService();
