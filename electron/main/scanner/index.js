const fs = require('fs');
const path = require('path');
const { BrowserWindow } = require('electron');
const dbService = require('../database/index.js');

const GAME_EXTENSIONS = new Set([
  '.iso', '.cso', '.bin', '.cue', '.chd', '.rvz', '.gcm', '.wbfs',
  '.nes', '.snes', '.smc', '.sfc', '.gba', '.gbc', '.gb', '.nds',
  '.n64', '.z64', '.rom', '.pkg', '.xbe', '.xex'
]);

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.vscode', '.idea', 'appdata', 'system32',
  'bios', 'sys', 'system', 'cores'
]);

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
        this._syncMissingConfigs();
      }

      dbService.persist(); // Batch persist!
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
    let bgFile = null;

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
      } else if (name === 'background.png' || name === 'background.jpg' || name === 'background.jpeg') {
        bgFile = path.join(dir, e.name);
      }
    }

    if (this.stats.filesDiscovered % 50 === 0) this._emit();

    let isEmulatorNode = false;
    if (configData) {
      const isTaggedEmulator = configData.tags && configData.tags.some(t => t.toLowerCase() === 'emulator');
      const isPlatformEmulator = configData.platform && configData.platform.toLowerCase() === 'emulator';
      const isExplicitPcGame = configData.type === 'pc' || (configData.platform && configData.platform.toLowerCase() === 'pc');
      
      isEmulatorNode = !isExplicitPcGame && (isTaggedEmulator || isPlatformEmulator);

      if (isEmulatorNode) {
        this._registerEmulator(configData, dir, iconFile);
      } else {
        if (bgFile && !configData.largecover) configData.largecover = bgFile;
        this._registerGame(configData, dir, iconFile, gameFiles);
      }
    } else if (gameFiles.length > 0) {
      for (const gf of gameFiles) {
        let gameName = path.basename(gf, path.extname(gf));
        let parentName = path.basename(dir);
        
        // PKG files or giant hashes usually mean the file name is garbage.
        // In these cases, the parent folder is the REAL game name, and the grandparent is the platform.
        if (gf.toLowerCase().endsWith('.pkg') || gameName.length > 25) {
          gameName = parentName; // "Tekken 5"
          parentName = path.basename(path.dirname(dir)); // "rpcs3"
        }

        this._registerGame({
          name: gameName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          display_name: gameName,
          platform: parentName,
          largecover: bgFile || ''
        }, dir, iconFile, [gf]);
      }
    }

    // Stop traversing deeper if this directory is the root of an emulator,
    // to prevent scanning its internal .bin files as games.
    if (isEmulatorNode) return;

    for (const e of entries) {
      if (this.cancelRequested) return;
      if (e.isDirectory() && !IGNORED_DIRS.has(e.name.toLowerCase()) && !e.name.startsWith('.')) {
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
    }, true);
    this.stats.emulatorsDiscovered++;
  }

  _registerGame(cfg, dir, defaultIcon, gameFiles) {
    let id = cfg.name || path.basename(dir).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    if (this.discoveredGameIds.has(id)) {
       id = id + '-' + Math.random().toString(36).substr(2, 5);
    }
    this.discoveredGameIds.add(id);

    const icon = cfg.icon && !path.isAbsolute(cfg.icon)
      ? path.join(dir, cfg.icon) : (cfg.icon || defaultIcon || '');
      
    const background = cfg.largecover && !path.isAbsolute(cfg.largecover)
      ? path.join(dir, cfg.largecover) : (cfg.largecover || '');

    const gamePath = gameFiles.length > 0 ? path.join(dir, gameFiles[0]) : dir;
    const parentFolder = path.basename(path.dirname(dir)).toLowerCase();
    
    let savePath = '';
    if (cfg.save && cfg.save.path) {
      savePath = cfg.save.path;
    }

    const exe = cfg.executable && !path.isAbsolute(cfg.executable)
      ? path.join(dir, cfg.executable) : (cfg.executable || '');
    
    let cwd = cfg.working_directory;
    if (cwd === '.' || cwd === './' || cwd === '.\\') {
      cwd = dir;
    } else if (cwd && !path.isAbsolute(cwd)) {
      cwd = path.join(dir, cwd);
    } else if (!cwd && exe) {
      cwd = dir;
    }

    dbService.upsertGame({
      id,
      name: cfg.name || id,
      display_name: cfg.display_name || path.basename(dir),
      type: cfg.executable ? 'pc' : 'emulator',
      platform: cfg.platform || 'Unknown',
      game_path: gamePath,
      executable: exe,
      arguments: cfg.arguments || '',
      working_directory: cwd || '',
      icon_path: icon,
      background_path: background,
      description: cfg.description || '',
      year: cfg.year || null,
      genre: cfg.genre || [],
      developer: cfg.developer || '',
      publisher: cfg.publisher || '',
      tags: cfg.tags || [],
      favorite: cfg.favorite || false,
      notes: cfg.notes || '',
      emulator_id: parentFolder || '',
      save_path: savePath,
      source_dir: dir
    }, true);
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

  _syncMissingConfigs() {
    const allGames = dbService.getAllGames();
    for (const game of allGames) {
      // Determine the directory where config and artwork should live
      let targetDir = game.source_dir;
      if (!targetDir) {
        if (game.type === 'pc') {
          targetDir = game.working_directory || (game.executable ? path.dirname(game.executable) : '');
        } else if (game.game_path) {
          targetDir = path.dirname(game.game_path);
        }
      }

      if (!targetDir || !fs.existsSync(targetDir)) continue;

      let updatedInDb = false;
      const configPath = path.join(targetDir, 'config.json');

      // 1. Copy icon to target directory if outside
      if (game.icon_path && fs.existsSync(game.icon_path)) {
        const iconExt = path.extname(game.icon_path) || '.png';
        const targetIconPath = path.join(targetDir, `icon${iconExt}`);
        if (path.resolve(game.icon_path).toLowerCase() !== path.resolve(targetIconPath).toLowerCase()) {
          try {
            fs.copyFileSync(game.icon_path, targetIconPath);
            game.icon_path = targetIconPath;
            updatedInDb = true;
          } catch (err) {
            console.error(`[Scanner] Failed to copy icon for ${game.display_name}:`, err);
          }
        }
      }

      // 2. Copy background/largecover to target directory if outside
      if (game.background_path && fs.existsSync(game.background_path)) {
        const bgExt = path.extname(game.background_path) || '.jpg';
        const targetBgPath = path.join(targetDir, `background${bgExt}`);
        if (path.resolve(game.background_path).toLowerCase() !== path.resolve(targetBgPath).toLowerCase()) {
          try {
            fs.copyFileSync(game.background_path, targetBgPath);
            game.background_path = targetBgPath;
            updatedInDb = true;
          } catch (err) {
            console.error(`[Scanner] Failed to copy background for ${game.display_name}:`, err);
          }
        }
      }

      // 3. Create or update config.json if missing
      if (!fs.existsSync(configPath)) {
        const configData = {
          name: game.name || game.id,
          display_name: game.display_name,
          platform: game.platform || (game.type === 'pc' ? 'PC' : 'Unknown')
        };

        if (game.type === 'pc' && game.executable) {
          const relExe = path.relative(targetDir, game.executable);
          configData.executable = (!relExe.startsWith('..') && !path.isAbsolute(relExe)) ? relExe : game.executable;
          if (game.arguments) configData.arguments = game.arguments;
          if (game.working_directory) {
            const relCwd = path.relative(targetDir, game.working_directory);
            configData.working_directory = (relCwd === '' || relCwd === '.') ? '.' : game.working_directory;
          } else {
            configData.working_directory = '.';
          }
        }

        if (game.icon_path) {
          const relIcon = path.relative(targetDir, game.icon_path);
          configData.icon = (!relIcon.startsWith('..') && !path.isAbsolute(relIcon)) ? relIcon : game.icon_path;
        }

        if (game.background_path) {
          const relBg = path.relative(targetDir, game.background_path);
          configData.largecover = (!relBg.startsWith('..') && !path.isAbsolute(relBg)) ? relBg : game.background_path;
        }

        if (game.description) configData.description = game.description;
        if (game.year) configData.year = game.year;
        if (game.genre && game.genre.length > 0) configData.genre = game.genre;
        if (game.developer) configData.developer = game.developer;
        if (game.publisher) configData.publisher = game.publisher;
        if (game.tags && game.tags.length > 0) configData.tags = game.tags;
        if (game.favorite) configData.favorite = game.favorite;
        if (game.notes) configData.notes = game.notes;
        if (game.save_path) {
          configData.save = { path: game.save_path };
        }

        try {
          fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
          console.log(`[Scanner] Created missing config.json for ${game.display_name} in ${targetDir}`);
        } catch (err) {
          console.error(`[Scanner] Failed to create config.json for ${game.display_name}:`, err);
        }
      }

      // 4. Update database paths if source_dir or copied files changed
      if (game.source_dir !== targetDir) {
        game.source_dir = targetDir;
        updatedInDb = true;
      }

      if (updatedInDb) {
        try {
          dbService.upsertGame(game);
        } catch (err) {
          console.error(`[Scanner] Failed to update DB paths for ${game.display_name}:`, err);
        }
      }
    }
  }
}

module.exports = new ScannerService();
