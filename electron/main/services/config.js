const fs = require('fs');
const path = require('path');

class ConfigService {
  constructor() {
    this.configsDir = null;
    this.gameConfigsDir = null;
    this.emulatorConfigsDir = null;
  }

  init(userDataPath) {
    const baseDir = userDataPath || path.join(process.cwd(), '.arcadia_data');
    this.configsDir = path.join(baseDir, 'configs');
    this.gameConfigsDir = path.join(this.configsDir, 'games');
    this.emulatorConfigsDir = path.join(this.configsDir, 'emulators');

    if (!fs.existsSync(this.gameConfigsDir)) {
      fs.mkdirSync(this.gameConfigsDir, { recursive: true });
    }
    if (!fs.existsSync(this.emulatorConfigsDir)) {
      fs.mkdirSync(this.emulatorConfigsDir, { recursive: true });
    }
  }

  // Sanitize filename safe string
  sanitizeId(str) {
    return (str || 'item').toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
  }

  // Game config file handling
  saveGameConfigFile(game) {
    if (!this.gameConfigsDir) return null;
    const filename = `${this.sanitizeId(game.name || game.id)}.json`;
    const filePath = path.join(this.gameConfigsDir, filename);

    const configData = {
      name: game.name || game.id,
      display_name: game.display_name || game.name,
      type: game.type || 'pc',
      platform: game.platform || 'PC',
      game_path: game.game_path,
      launch: game.type === 'pc' ? (game.launch || {
        executable: game.game_path,
        arguments: [],
        working_directory: path.dirname(game.game_path || '')
      }) : undefined,
      emulator: game.type === 'emulator' ? (game.emulator || {
        name: '',
        path: '',
        arguments: []
      }) : undefined,
      save: game.save || {
        path: ''
      },
      artwork: game.artwork || {
        cover: '',
        background: '',
        icon: ''
      },
      description: game.description || '',
      year: game.year || null,
      genre: Array.isArray(game.genre) ? game.genre : (game.genre ? [game.genre] : []),
      developer: game.developer || '',
      publisher: game.publisher || '',
      tags: Array.isArray(game.tags) ? game.tags : [],
      favorite: Boolean(game.favorite),
      notes: game.notes || ''
    };

    fs.writeFileSync(filePath, JSON.stringify(configData, null, 2), 'utf-8');
    return filePath;
  }

  loadGameConfigFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      console.error('Failed to parse game config:', filePath, err);
      return null;
    }
  }

  removeGameConfigFile(nameOrId) {
    const filename = `${this.sanitizeId(nameOrId)}.json`;
    const filePath = path.join(this.gameConfigsDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  // Emulator config file handling
  saveEmulatorConfigFile(emulator) {
    if (!this.emulatorConfigsDir) return null;
    const filename = `${this.sanitizeId(emulator.name || emulator.id)}.json`;
    const filePath = path.join(this.emulatorConfigsDir, filename);

    const configData = {
      name: emulator.name,
      display_name: emulator.display_name || emulator.name,
      platform: emulator.platform || 'Other',
      executable: emulator.executable,
      working_directory: emulator.working_directory || path.dirname(emulator.executable || ''),
      arguments: Array.isArray(emulator.arguments) ? emulator.arguments : [],
      version: emulator.version || '',
      icon: emulator.icon || '',
      notes: emulator.notes || '',
      is_default: Boolean(emulator.is_default)
    };

    fs.writeFileSync(filePath, JSON.stringify(configData, null, 2), 'utf-8');
    return filePath;
  }

  removeEmulatorConfigFile(nameOrId) {
    const filename = `${this.sanitizeId(nameOrId)}.json`;
    const filePath = path.join(this.emulatorConfigsDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  getAllGameConfigFiles() {
    if (!fs.existsSync(this.gameConfigsDir)) return [];
    const files = fs.readdirSync(this.gameConfigsDir);
    const configs = [];
    for (const f of files) {
      if (f.endsWith('.json')) {
        const parsed = this.loadGameConfigFile(path.join(this.gameConfigsDir, f));
        if (parsed) configs.push(parsed);
      }
    }
    return configs;
  }
}

module.exports = new ConfigService();
