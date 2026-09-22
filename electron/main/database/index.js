const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.SQL = null;
    this.isInitialized = false;
  }

  async init(userDataPath) {
    if (this.isInitialized) return;

    this.SQL = await initSqlJs();
    const dataDir = userDataPath || path.join(process.cwd(), '.arcadia_data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.dbPath = path.join(dataDir, 'arcadia.db');

    let fileBuffer = null;
    if (fs.existsSync(this.dbPath)) {
      try {
        fileBuffer = fs.readFileSync(this.dbPath);
      } catch (err) {
        console.error('Failed to read existing database file, creating new:', err);
      }
    }

    this.db = fileBuffer ? new this.SQL.Database(fileBuffer) : new this.SQL.Database();
    this.initSchema();
    this.persist();
    this.isInitialized = true;
    console.log('[DatabaseService] Database initialized at', this.dbPath);
  }

  persist() {
    if (!this.db || !this.dbPath) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (err) {
      console.error('[DatabaseService] Failed to persist database:', err);
    }
  }

  initSchema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        name TEXT,
        display_name TEXT NOT NULL,
        type TEXT NOT NULL,
        platform TEXT NOT NULL,
        game_path TEXT NOT NULL,
        launch_json TEXT,
        emulator_json TEXT,
        save_json TEXT,
        artwork_json TEXT,
        description TEXT,
        year INTEGER,
        genre TEXT,
        developer TEXT,
        publisher TEXT,
        tags TEXT,
        favorite INTEGER DEFAULT 0,
        notes TEXT,
        last_played TEXT,
        play_count INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS emulators (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        platform TEXT NOT NULL,
        executable TEXT NOT NULL,
        working_directory TEXT,
        arguments_json TEXT,
        version TEXT,
        icon TEXT,
        notes TEXT,
        is_default INTEGER DEFAULT 0,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS game_emulators (
        game_id TEXT NOT NULL,
        emulator_id TEXT NOT NULL,
        PRIMARY KEY (game_id, emulator_id)
      );

      CREATE TABLE IF NOT EXISTS favorites (
        game_id TEXT PRIMARY KEY,
        added_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS play_history (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        played_at TEXT NOT NULL,
        duration_seconds INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS library_locations (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        enabled INTEGER DEFAULT 1,
        last_scanned TEXT
      );

      CREATE TABLE IF NOT EXISTS save_locations (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        source_path TEXT NOT NULL,
        destination_path TEXT NOT NULL,
        last_populated TEXT
      );

      CREATE TABLE IF NOT EXISTS save_backups (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        game_name TEXT,
        backup_path TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        trigger_type TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
    `);

    // Pre-populate default emulators if empty
    const emuCount = this.db.exec("SELECT COUNT(*) as count FROM emulators");
    if (emuCount[0]?.values[0]?.[0] === 0) {
      const defaults = [
        { id: 'xemu', name: 'xemu', display_name: 'Xemu', platform: 'Xbox', executable: 'C:/Emulators/xemu/xemu.exe', working_directory: 'C:/Emulators/xemu/', arguments_json: '[]', version: '0.7.118', is_default: 1 },
        { id: 'pcsx2', name: 'pcsx2', display_name: 'PCSX2', platform: 'PS2', executable: 'C:/Emulators/pcsx2/pcsx2.exe', working_directory: 'C:/Emulators/pcsx2/', arguments_json: '[]', version: '2.0.2', is_default: 1 },
        { id: 'dolphin', name: 'dolphin', display_name: 'Dolphin', platform: 'GameCube / Wii', executable: 'C:/Emulators/dolphin/Dolphin.exe', working_directory: 'C:/Emulators/dolphin/', arguments_json: '[]', version: '5.0-21460', is_default: 1 },
        { id: 'ppsspp', name: 'ppsspp', display_name: 'PPSSPP', platform: 'PSP', executable: 'C:/Emulators/ppsspp/PPSSPPWindows64.exe', working_directory: 'C:/Emulators/ppsspp/', arguments_json: '[]', version: '1.17.1', is_default: 1 },
        { id: 'rpcs3', name: 'rpcs3', display_name: 'RPCS3', platform: 'PS3', executable: 'C:/Emulators/rpcs3/rpcs3.exe', working_directory: 'C:/Emulators/rpcs3/', arguments_json: '[]', version: '0.0.32', is_default: 1 },
        { id: 'duckstation', name: 'duckstation', display_name: 'DuckStation', platform: 'PS1', executable: 'C:/Emulators/duckstation/duckstation-qt-x64-ReleaseLTCG.exe', working_directory: 'C:/Emulators/duckstation/', arguments_json: '[]', version: '0.1-6800', is_default: 1 }
      ];

      for (const emu of defaults) {
        this.db.run(
          `INSERT INTO emulators (id, name, display_name, platform, executable, working_directory, arguments_json, version, is_default, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [emu.id, emu.name, emu.display_name, emu.platform, emu.executable, emu.working_directory, emu.arguments_json, emu.version, emu.is_default, new Date().toISOString()]
        );
      }
    }
  }

  // Games CRUD
  getAllGames() {
    const res = this.db.exec("SELECT * FROM games ORDER BY favorite DESC, display_name ASC");
    if (!res || res.length === 0) return [];
    const columns = res[0].columns;
    return res[0].values.map(row => {
      const obj = {};
      columns.forEach((col, idx) => obj[col] = row[idx]);
      return this._formatGame(obj);
    });
  }

  getGameById(id) {
    const res = this.db.exec("SELECT * FROM games WHERE id = ?", [id]);
    if (!res || res.length === 0 || res[0].values.length === 0) return null;
    const columns = res[0].columns;
    const obj = {};
    columns.forEach((col, idx) => obj[col] = res[0].values[0][idx]);
    return this._formatGame(obj);
  }

  upsertGame(game) {
    const existing = this.getGameById(game.id);
    const now = new Date().toISOString();
    const genres = Array.isArray(game.genre) ? JSON.stringify(game.genre) : (typeof game.genre === 'string' ? game.genre : '[]');
    const tags = Array.isArray(game.tags) ? JSON.stringify(game.tags) : (typeof game.tags === 'string' ? game.tags : '[]');

    if (existing) {
      this.db.run(`
        UPDATE games SET
          name = ?, display_name = ?, type = ?, platform = ?, game_path = ?,
          launch_json = ?, emulator_json = ?, save_json = ?, artwork_json = ?,
          description = ?, year = ?, genre = ?, developer = ?, publisher = ?,
          tags = ?, favorite = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `, [
        game.name || game.id,
        game.display_name || game.name || 'Untitled Game',
        game.type || 'pc',
        game.platform || 'PC',
        game.game_path || '',
        JSON.stringify(game.launch || {}),
        JSON.stringify(game.emulator || null),
        JSON.stringify(game.save || {}),
        JSON.stringify(game.artwork || {}),
        game.description || '',
        game.year || null,
        genres,
        game.developer || '',
        game.publisher || '',
        tags,
        game.favorite ? 1 : 0,
        game.notes || '',
        now,
        game.id
      ]);
    } else {
      this.db.run(`
        INSERT INTO games (
          id, name, display_name, type, platform, game_path,
          launch_json, emulator_json, save_json, artwork_json,
          description, year, genre, developer, publisher,
          tags, favorite, notes, last_played, play_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        game.id,
        game.name || game.id,
        game.display_name || game.name || 'Untitled Game',
        game.type || 'pc',
        game.platform || 'PC',
        game.game_path || '',
        JSON.stringify(game.launch || {}),
        JSON.stringify(game.emulator || null),
        JSON.stringify(game.save || {}),
        JSON.stringify(game.artwork || {}),
        game.description || '',
        game.year || null,
        genres,
        game.developer || '',
        game.publisher || '',
        tags,
        game.favorite ? 1 : 0,
        game.notes || '',
        null,
        0,
        now,
        now
      ]);
    }
    this.persist();
    return this.getGameById(game.id);
  }

  toggleFavorite(id) {
    const game = this.getGameById(id);
    if (!game) return null;
    const newFav = game.favorite ? 0 : 1;
    this.db.run("UPDATE games SET favorite = ?, updated_at = ? WHERE id = ?", [newFav, new Date().toISOString(), id]);
    this.persist();
    return { ...game, favorite: Boolean(newFav) };
  }

  recordGameLaunch(id) {
    const game = this.getGameById(id);
    if (!game) return;
    const now = new Date().toISOString();
    const newCount = (game.play_count || 0) + 1;
    this.db.run("UPDATE games SET last_played = ?, play_count = ? WHERE id = ?", [now, newCount, id]);
    this.persist();
  }

  removeGame(id) {
    this.db.run("DELETE FROM games WHERE id = ?", [id]);
    this.persist();
    return true;
  }

  _formatGame(row) {
    let genre = [];
    try { genre = JSON.parse(row.genre); } catch { genre = row.genre ? [row.genre] : []; }
    let tags = [];
    try { tags = JSON.parse(row.tags); } catch { tags = row.tags ? [row.tags] : []; }
    let launch = {};
    try { launch = JSON.parse(row.launch_json || '{}'); } catch {}
    let emulator = null;
    try { emulator = JSON.parse(row.emulator_json || 'null'); } catch {}
    let save = {};
    try { save = JSON.parse(row.save_json || '{}'); } catch {}
    let artwork = {};
    try { artwork = JSON.parse(row.artwork_json || '{}'); } catch {}

    return {
      id: row.id,
      name: row.name,
      display_name: row.display_name,
      type: row.type,
      platform: row.platform,
      game_path: row.game_path,
      launch,
      emulator,
      save,
      artwork,
      description: row.description || '',
      year: row.year,
      genre,
      developer: row.developer || '',
      publisher: row.publisher || '',
      tags,
      favorite: Boolean(row.favorite),
      notes: row.notes || '',
      last_played: row.last_played,
      play_count: row.play_count || 0,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  // Emulators CRUD
  getAllEmulators() {
    const res = this.db.exec("SELECT * FROM emulators ORDER BY platform ASC, display_name ASC");
    if (!res || res.length === 0) return [];
    const columns = res[0].columns;
    return res[0].values.map(row => {
      const obj = {};
      columns.forEach((col, idx) => obj[col] = row[idx]);
      return this._formatEmulator(obj);
    });
  }

  getEmulatorById(id) {
    const res = this.db.exec("SELECT * FROM emulators WHERE id = ?", [id]);
    if (!res || res.length === 0 || res[0].values.length === 0) return null;
    const columns = res[0].columns;
    const obj = {};
    columns.forEach((col, idx) => obj[col] = res[0].values[0][idx]);
    return this._formatEmulator(obj);
  }

  getEmulatorByName(name) {
    const res = this.db.exec("SELECT * FROM emulators WHERE LOWER(name) = ? OR LOWER(display_name) = ?", [name.toLowerCase(), name.toLowerCase()]);
    if (!res || res.length === 0 || res[0].values.length === 0) return null;
    const columns = res[0].columns;
    const obj = {};
    columns.forEach((col, idx) => obj[col] = res[0].values[0][idx]);
    return this._formatEmulator(obj);
  }

  getDefaultEmulatorForPlatform(platform) {
    const res = this.db.exec("SELECT * FROM emulators WHERE LOWER(platform) = ? AND is_default = 1", [platform.toLowerCase()]);
    if (res && res.length > 0 && res[0].values.length > 0) {
      const columns = res[0].columns;
      const obj = {};
      columns.forEach((col, idx) => obj[col] = res[0].values[0][idx]);
      return this._formatEmulator(obj);
    }
    // Fallback: any emulator for this platform
    const fallback = this.db.exec("SELECT * FROM emulators WHERE LOWER(platform) = ? LIMIT 1", [platform.toLowerCase()]);
    if (fallback && fallback.length > 0 && fallback[0].values.length > 0) {
      const columns = fallback[0].columns;
      const obj = {};
      columns.forEach((col, idx) => obj[col] = fallback[0].values[0][idx]);
      return this._formatEmulator(obj);
    }
    return null;
  }

  upsertEmulator(emu) {
    const existing = this.getEmulatorById(emu.id);
    const argsJson = Array.isArray(emu.arguments) ? JSON.stringify(emu.arguments) : (typeof emu.arguments === 'string' ? emu.arguments : '[]');

    if (emu.is_default) {
      // Clear default for other emulators of the same platform
      this.db.run("UPDATE emulators SET is_default = 0 WHERE LOWER(platform) = ?", [(emu.platform || '').toLowerCase()]);
    }

    if (existing) {
      this.db.run(`
        UPDATE emulators SET
          name = ?, display_name = ?, platform = ?, executable = ?,
          working_directory = ?, arguments_json = ?, version = ?,
          icon = ?, notes = ?, is_default = ?
        WHERE id = ?
      `, [
        emu.name,
        emu.display_name,
        emu.platform,
        emu.executable,
        emu.working_directory || '',
        argsJson,
        emu.version || '',
        emu.icon || '',
        emu.notes || '',
        emu.is_default ? 1 : 0,
        emu.id
      ]);
    } else {
      this.db.run(`
        INSERT INTO emulators (
          id, name, display_name, platform, executable,
          working_directory, arguments_json, version, icon, notes, is_default, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        emu.id || (emu.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')),
        emu.name,
        emu.display_name,
        emu.platform,
        emu.executable,
        emu.working_directory || '',
        argsJson,
        emu.version || '',
        emu.icon || '',
        emu.notes || '',
        emu.is_default ? 1 : 0,
        new Date().toISOString()
      ]);
    }
    this.persist();
    return this.getEmulatorById(emu.id || emu.name);
  }

  removeEmulator(id) {
    this.db.run("DELETE FROM emulators WHERE id = ?", [id]);
    this.persist();
    return true;
  }

  _formatEmulator(row) {
    let args = [];
    try { args = JSON.parse(row.arguments_json || '[]'); } catch { args = []; }
    return {
      id: row.id,
      name: row.name,
      display_name: row.display_name,
      platform: row.platform,
      executable: row.executable,
      working_directory: row.working_directory || '',
      arguments: args,
      version: row.version || '',
      icon: row.icon || '',
      notes: row.notes || '',
      is_default: Boolean(row.is_default),
      created_at: row.created_at
    };
  }

  // Library Locations
  getLibraryLocations() {
    const res = this.db.exec("SELECT * FROM library_locations ORDER BY path ASC");
    if (!res || res.length === 0) return [];
    const columns = res[0].columns;
    return res[0].values.map(row => {
      const obj = {};
      columns.forEach((col, idx) => obj[col] = row[idx]);
      return {
        id: obj.id,
        path: obj.path,
        enabled: Boolean(obj.enabled),
        last_scanned: obj.last_scanned
      };
    });
  }

  addLibraryLocation(locPath) {
    const norm = path.normalize(locPath);
    const id = Buffer.from(norm).toString('base64').replace(/=/g, '');
    this.db.run("INSERT OR REPLACE INTO library_locations (id, path, enabled, last_scanned) VALUES (?, ?, 1, ?)", [
      id, norm, new Date().toISOString()
    ]);
    this.persist();
    return { id, path: norm, enabled: true };
  }

  removeLibraryLocation(id) {
    this.db.run("DELETE FROM library_locations WHERE id = ? OR path = ?", [id, id]);
    this.persist();
    return true;
  }

  updateLocationScanTime(id) {
    this.db.run("UPDATE library_locations SET last_scanned = ? WHERE id = ?", [new Date().toISOString(), id]);
    this.persist();
  }

  // Save Backups
  recordSaveBackup(backup) {
    const id = backup.id || 'bak_' + Date.now();
    this.db.run(`
      INSERT INTO save_backups (id, game_id, game_name, backup_path, timestamp, trigger_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id,
      backup.game_id,
      backup.game_name || '',
      backup.backup_path,
      backup.timestamp || new Date().toISOString(),
      backup.trigger_type || 'manual'
    ]);
    this.persist();
    return id;
  }

  getSaveBackups(gameId = null) {
    let sql = "SELECT * FROM save_backups ORDER BY timestamp DESC";
    let params = [];
    if (gameId) {
      sql = "SELECT * FROM save_backups WHERE game_id = ? ORDER BY timestamp DESC";
      params = [gameId];
    }
    const res = this.db.exec(sql, params);
    if (!res || res.length === 0) return [];
    const columns = res[0].columns;
    return res[0].values.map(row => {
      const obj = {};
      columns.forEach((col, idx) => obj[col] = row[idx]);
      return obj;
    });
  }

  // Settings
  getSetting(key, defaultValue = null) {
    const res = this.db.exec("SELECT value_json FROM settings WHERE key = ?", [key]);
    if (!res || res.length === 0 || res[0].values.length === 0) return defaultValue;
    try {
      return JSON.parse(res[0].values[0][0]);
    } catch {
      return res[0].values[0][0];
    }
  }

  setSetting(key, value) {
    const valJson = JSON.stringify(value);
    this.db.run("INSERT OR REPLACE INTO settings (key, value_json) VALUES (?, ?)", [key, valJson]);
    this.persist();
  }

  getAllSettings() {
    const res = this.db.exec("SELECT key, value_json FROM settings");
    const settings = {};
    if (res && res.length > 0) {
      for (const row of res[0].values) {
        try {
          settings[row[0]] = JSON.parse(row[1]);
        } catch {
          settings[row[0]] = row[1];
        }
      }
    }
    return settings;
  }

  rebuildDatabase() {
    this.db.run("DROP TABLE IF EXISTS games;");
    this.db.run("DROP TABLE IF EXISTS emulators;");
    this.db.run("DROP TABLE IF EXISTS library_locations;");
    this.db.run("DROP TABLE IF EXISTS save_backups;");
    this.initSchema();
    this.persist();
    return true;
  }
}

module.exports = new DatabaseService();
