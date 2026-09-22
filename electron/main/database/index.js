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
        console.error('[DB] Failed to read existing database, creating new:', err);
      }
    }

    this.db = fileBuffer ? new this.SQL.Database(fileBuffer) : new this.SQL.Database();
    this._initSchema();
    this.persist();
    this.isInitialized = true;
    console.log('[DB] Initialized at', this.dbPath);
  }

  persist() {
    if (!this.db || !this.dbPath) return;
    try {
      const data = this.db.export();
      fs.writeFileSync(this.dbPath, Buffer.from(data));
    } catch (err) {
      console.error('[DB] Failed to persist:', err);
    }
  }

  _initSchema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'emulator',
        platform TEXT NOT NULL DEFAULT 'Unknown',
        game_path TEXT,
        executable TEXT DEFAULT '',
        arguments TEXT DEFAULT '',
        working_directory TEXT DEFAULT '',
        icon_path TEXT,
        description TEXT DEFAULT '',
        year INTEGER,
        genre TEXT DEFAULT '[]',
        developer TEXT DEFAULT '',
        publisher TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        favorite INTEGER DEFAULT 0,
        notes TEXT DEFAULT '',
        emulator_id TEXT DEFAULT '',
        save_path TEXT DEFAULT '',
        last_played TEXT,
        play_count INTEGER DEFAULT 0,
        source_dir TEXT DEFAULT '',
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS emulators (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT 'Unknown',
        executable TEXT NOT NULL,
        working_directory TEXT DEFAULT '',
        arguments TEXT DEFAULT '',
        icon_path TEXT DEFAULT '',
        description TEXT DEFAULT '',
        version TEXT DEFAULT '',
        developer TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        is_default INTEGER DEFAULT 0,
        notes TEXT DEFAULT '',
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
    `);

    // Ensure new columns exist on older databases
    try { this.db.run("ALTER TABLE games ADD COLUMN executable TEXT DEFAULT ''"); } catch {}
    try { this.db.run("ALTER TABLE games ADD COLUMN arguments TEXT DEFAULT ''"); } catch {}
    try { this.db.run("ALTER TABLE games ADD COLUMN working_directory TEXT DEFAULT ''"); } catch {}
  }

  /* ============ HELPER ============ */
  _rows(sql, params = []) {
    const res = this.db.exec(sql, params);
    if (!res || res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map(row => {
      const obj = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
  }

  _row(sql, params = []) {
    const rows = this._rows(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /* ============ GAMES ============ */
  getAllGames() {
    return this._rows("SELECT * FROM games ORDER BY favorite DESC, display_name ASC").map(r => this._fmtGame(r));
  }

  getGameById(id) {
    const r = this._row("SELECT * FROM games WHERE id = ?", [id]);
    return r ? this._fmtGame(r) : null;
  }

  upsertGame(g) {
    if (!g || !g.id) throw new Error('Game must have an id');
    const now = new Date().toISOString();
    const genre = JSON.stringify(Array.isArray(g.genre) ? g.genre : []);
    const tags = JSON.stringify(Array.isArray(g.tags) ? g.tags : []);
    const existing = this._row("SELECT id FROM games WHERE id = ?", [g.id]);

    if (existing) {
      this.db.run(`UPDATE games SET name=?, display_name=?, type=?, platform=?, game_path=?,
        executable=?, arguments=?, working_directory=?,
        icon_path=?, description=?, year=?, genre=?, developer=?, publisher=?, tags=?,
        favorite=?, notes=?, emulator_id=?, save_path=?, source_dir=?, updated_at=?
        WHERE id=?`, [
        g.name || g.id, g.display_name || g.name || 'Untitled',
        g.type || 'emulator', g.platform || 'Unknown', g.game_path || '',
        g.executable || '', g.arguments || '', g.working_directory || '',
        g.icon_path || '', g.description || '', g.year || null,
        genre, g.developer || '', g.publisher || '', tags,
        g.favorite ? 1 : 0, g.notes || '', g.emulator_id || '',
        g.save_path || '', g.source_dir || '', now, g.id
      ]);
    } else {
      this.db.run(`INSERT INTO games (id, name, display_name, type, platform, game_path,
        executable, arguments, working_directory,
        icon_path, description, year, genre, developer, publisher, tags,
        favorite, notes, emulator_id, save_path, source_dir, last_played, play_count, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
        g.id, g.name || g.id, g.display_name || g.name || 'Untitled',
        g.type || 'emulator', g.platform || 'Unknown', g.game_path || '',
        g.executable || '', g.arguments || '', g.working_directory || '',
        g.icon_path || '', g.description || '', g.year || null,
        genre, g.developer || '', g.publisher || '', tags,
        g.favorite ? 1 : 0, g.notes || '', g.emulator_id || '',
        g.save_path || '', g.source_dir || '', null, 0, now, now
      ]);
    }
    this.persist();
    return this.getGameById(g.id);
  }

  toggleFavorite(id) {
    const g = this.getGameById(id);
    if (!g) return null;
    const newVal = g.favorite ? 0 : 1;
    this.db.run("UPDATE games SET favorite=?, updated_at=? WHERE id=?", [newVal, new Date().toISOString(), id]);
    this.persist();
    return this.getGameById(id);
  }

  recordGameLaunch(id) {
    const g = this.getGameById(id);
    if (!g) return;
    this.db.run("UPDATE games SET last_played=?, play_count=? WHERE id=?",
      [new Date().toISOString(), (g.play_count || 0) + 1, id]);
    this.persist();
  }

  removeGame(id) {
    this.db.run("DELETE FROM games WHERE id=?", [id]);
    this.persist();
    return true;
  }

  _fmtGame(r) {
    let genre = [], tags = [];
    try { genre = JSON.parse(r.genre || '[]'); } catch { genre = []; }
    try { tags = JSON.parse(r.tags || '[]'); } catch { tags = []; }
    return {
      ...r,
      genre, tags,
      favorite: Boolean(r.favorite),
      play_count: r.play_count || 0
    };
  }

  /* ============ EMULATORS ============ */
  getAllEmulators() {
    const emus = this._rows("SELECT * FROM emulators ORDER BY platform ASC, display_name ASC").map(r => this._fmtEmu(r));
    const counts = this._rows("SELECT emulator_id, COUNT(id) as cnt FROM games GROUP BY emulator_id");
    const countMap = {};
    for (const row of counts) countMap[row.emulator_id] = row.cnt;
    for (const e of emus) e.game_count = countMap[e.id] || 0;
    return emus;
  }

  getEmulatorById(id) {
    const r = this._row("SELECT * FROM emulators WHERE id = ?", [id]);
    return r ? this._fmtEmu(r) : null;
  }

  getDefaultEmulatorForPlatform(platform) {
    const r = this._row("SELECT * FROM emulators WHERE LOWER(platform)=? AND is_default=1", [platform.toLowerCase()]);
    if (r) return this._fmtEmu(r);
    const fallback = this._row("SELECT * FROM emulators WHERE LOWER(platform)=? LIMIT 1", [platform.toLowerCase()]);
    return fallback ? this._fmtEmu(fallback) : null;
  }

  upsertEmulator(e) {
    if (!e || !e.name) throw new Error('Emulator must have a name');
    const id = e.id || e.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const existing = this._row("SELECT id FROM emulators WHERE id = ?", [id]);
    const args = typeof e.arguments === 'string' ? e.arguments :
                 Array.isArray(e.arguments) ? e.arguments.join(' ') : '';
    const tags = JSON.stringify(Array.isArray(e.tags) ? e.tags : []);

    if (e.is_default) {
      this.db.run("UPDATE emulators SET is_default=0 WHERE LOWER(platform)=?", [(e.platform || '').toLowerCase()]);
    }

    if (existing) {
      this.db.run(`UPDATE emulators SET name=?, display_name=?, platform=?, executable=?,
        working_directory=?, arguments=?, icon_path=?, description=?, version=?,
        developer=?, tags=?, is_default=?, notes=? WHERE id=?`, [
        e.name, e.display_name || e.name, e.platform || 'Unknown',
        e.executable, e.working_directory || '', args,
        e.icon_path || '', e.description || '', e.version || '',
        e.developer || '', tags, e.is_default ? 1 : 0, e.notes || '', id
      ]);
    } else {
      this.db.run(`INSERT INTO emulators (id, name, display_name, platform, executable,
        working_directory, arguments, icon_path, description, version,
        developer, tags, is_default, notes, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
        id, e.name, e.display_name || e.name, e.platform || 'Unknown',
        e.executable, e.working_directory || '', args,
        e.icon_path || '', e.description || '', e.version || '',
        e.developer || '', tags, e.is_default ? 1 : 0, e.notes || '',
        new Date().toISOString()
      ]);
    }
    this.persist();
    return this.getEmulatorById(id);
  }

  removeEmulator(id) {
    this.db.run("DELETE FROM emulators WHERE id=?", [id]);
    this.persist();
    return true;
  }

  _fmtEmu(r) {
    let tags = [];
    try { tags = JSON.parse(r.tags || '[]'); } catch { tags = []; }
    return { ...r, tags, is_default: Boolean(r.is_default) };
  }

  getGamesForEmulator(emuId) {
    return this._rows("SELECT * FROM games WHERE emulator_id=?", [emuId]).map(r => this._fmtGame(r));
  }

  /* ============ SETTINGS ============ */
  getSetting(key, defaultValue = null) {
    const r = this._row("SELECT value_json FROM settings WHERE key=?", [key]);
    if (!r) return defaultValue;
    try { return JSON.parse(r.value_json); } catch { return r.value_json; }
  }

  setSetting(key, value) {
    this.db.run("INSERT OR REPLACE INTO settings (key, value_json) VALUES (?,?)", [key, JSON.stringify(value)]);
    this.persist();
  }

  getAllSettings() {
    const rows = this._rows("SELECT key, value_json FROM settings");
    const out = {};
    for (const r of rows) {
      try { out[r.key] = JSON.parse(r.value_json); } catch { out[r.key] = r.value_json; }
    }
    return out;
  }

  /* ============ MAINTENANCE ============ */
  clearAllGames() {
    this.db.run("DELETE FROM games");
    this.persist();
  }

  clearAllEmulators() {
    this.db.run("DELETE FROM emulators");
    this.persist();
  }

  rebuildDatabase() {
    this.db.run("DROP TABLE IF EXISTS games");
    this.db.run("DROP TABLE IF EXISTS emulators");
    this._initSchema();
    this.persist();
    return true;
  }
}

module.exports = new DatabaseService();
