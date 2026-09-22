const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dbService = require('../database/index.js');
const savesService = require('../saves/index.js');

class LauncherService {
  constructor() {
    this.activeProcesses = new Map();
  }

  async launch(gameId) {
    if (this.activeProcesses.has(gameId)) {
      throw new Error('Game is already running');
    }

    const game = dbService.getGameById(gameId);
    if (!game) {
      throw new Error(`Game with ID ${gameId} not found in database.`);
    }

    // Auto-backup before launch
    const backupBefore = dbService.getSetting('backup_before_launch', false);
    if (backupBefore && game.save_path) {
      console.log(`[Launcher] Performing pre-launch backup for ${game.display_name}...`);
      await savesService.backupSave(game.id, false);
    }

    if (game.type === 'pc') {
      return this._launchPCGame(game);
    } else if (game.type === 'emulator') {
      return this._launchEmulatorGame(game);
    } else {
      throw new Error(`Unknown game type: ${game.type}`);
    }
  }

  _setupProcessTracking(child, game) {
    this.activeProcesses.set(game.id, child);
    dbService.recordGameLaunch(game.id);

    child.on('exit', async (code) => {
      console.log(`[Launcher] Process for ${game.display_name} exited with code ${code}`);
      this.activeProcesses.delete(game.id);
      
      const backupOnExit = dbService.getSetting('backup_on_exit', false);
      if (backupOnExit && game.save_path) {
        console.log(`[Launcher] Performing post-exit backup for ${game.display_name}...`);
        await savesService.backupSave(game.id, false);
      }
    });
  }

  async _launchEmulatorGame(game) {
    // 1. Smart emulator resolution
    let emu = null;
    if (game.emulator_id) {
      emu = dbService.getEmulatorById(game.emulator_id);
    }
    if (!emu && game.platform) {
      emu = dbService.getDefaultEmulatorForPlatform(game.platform);
    }
    if (!emu) {
      throw new Error('Configuration Error: No suitable emulator found for this game or platform.');
    }

    // 2. Executable validation
    if (!emu.executable) {
      throw new Error(`Emulator "${emu.display_name}" is missing an executable path.`);
    }
    if (!fs.existsSync(emu.executable)) {
      throw new Error(`Emulator executable not found at path: ${emu.executable}`);
    }

    // 3. Game path validation
    if (game.game_path && !fs.existsSync(game.game_path)) {
      throw new Error(`Game file not found at path: ${game.game_path}`);
    }

    // 4. Working directory handling
    let cwd = emu.working_directory;
    if (!cwd || cwd.trim() === '') {
      cwd = path.dirname(emu.executable);
    }
    if (!fs.existsSync(cwd)) {
      throw new Error(`Working directory not found: ${cwd}`);
    }

    // 5. Argument handling
    let argsString = emu.arguments || '';
    const hasGamePathToken = argsString.includes('{game_path}');
    
    let args = [];
    if (argsString.trim() !== '') {
      const regex = /[^\s"]+|"([^"]*)"/gi;
      let match;
      while ((match = regex.exec(argsString)) != null) {
        let token = match[1] ? match[1] : match[0];
        // Replace token safely AFTER splitting so spaces in the path don't break parsing
        token = token.replace(/{game_path}/g, game.game_path || '');
        args.push(token);
      }
    }
    
    if (game.arguments && game.arguments.trim() !== '') {
      const regex = /[^\s"]+|"([^"]*)"/gi;
      let match;
      while ((match = regex.exec(game.arguments)) != null) {
        let token = match[1] ? match[1] : match[0];
        token = token.replace(/{game_path}/g, game.game_path || '');
        args.push(token);
      }
    }

    // Implicitly append the game path if the emulator arguments didn't explicitly place it
    if (!hasGamePathToken && game.game_path) {
      args.push(game.game_path);
    }

    return new Promise((resolve, reject) => {
      try {
        const isBatch = emu.executable.toLowerCase().endsWith('.bat') || emu.executable.toLowerCase().endsWith('.cmd');
        const child = spawn(emu.executable, args, { cwd, detached: false, shell: isBatch, stdio: 'ignore' });
        let hasErrored = false;

        child.on('error', (err) => {
          hasErrored = true;
          reject(new Error(`Failed to launch emulator: ${err.message}`));
        });

        setTimeout(() => {
          if (!hasErrored) {
            this._setupProcessTracking(child, game);
            resolve({ success: true, message: `Launched ${game.display_name} via ${emu.display_name}` });
          }
        }, 800);
      } catch (error) {
        reject(new Error(`Failed to launch emulator: ${error.message}`));
      }
    });
  }

  async _launchPCGame(game) {
    if (!game.executable) throw new Error('Executable path is not configured for this game.');
    if (!fs.existsSync(game.executable)) throw new Error(`Executable not found at path: ${game.executable}`);

    let cwd = game.working_directory;
    if (!cwd || cwd.trim() === '') cwd = path.dirname(game.executable);
    if (!fs.existsSync(cwd)) throw new Error(`Working directory not found: ${cwd}`);

    let args = [];
    if (game.arguments && game.arguments.trim() !== '') {
      const regex = /[^\s"]+|"([^"]*)"/gi;
      let match;
      while ((match = regex.exec(game.arguments)) != null) {
        let token = match[1] ? match[1] : match[0];
        token = token.replace(/{game_path}/g, game.game_path || '');
        args.push(token);
      }
    }

    return new Promise((resolve, reject) => {
      try {
        const isBatch = game.executable.toLowerCase().endsWith('.bat') || game.executable.toLowerCase().endsWith('.cmd');
        const child = spawn(game.executable, args, { cwd, detached: false, shell: isBatch, stdio: 'ignore' });
        let hasErrored = false;

        child.on('error', (err) => {
          hasErrored = true;
          reject(new Error(`Failed to launch process: ${err.message}`));
        });

        setTimeout(() => {
          if (!hasErrored) {
            this._setupProcessTracking(child, game);
            resolve({ success: true, message: `Launched ${game.display_name}` });
          }
        }, 800);
      } catch (error) {
        reject(new Error(`Failed to launch process: ${error.message}`));
      }
    });
  }

  async launchEmulator(emuId) {
    const emu = dbService.getEmulatorById(emuId);
    if (!emu) {
      throw new Error(`Emulator with ID ${emuId} not found in database.`);
    }
    
    if (!emu.executable) {
      throw new Error('Executable path is not configured for this emulator.');
    }

    if (!fs.existsSync(emu.executable)) {
      throw new Error(`Executable not found at path: ${emu.executable}`);
    }

    let cwd = emu.working_directory;
    if (!cwd || cwd.trim() === '') {
      cwd = path.dirname(emu.executable);
    }

    if (!fs.existsSync(cwd)) {
      throw new Error(`Working directory not found: ${cwd}`);
    }

    let args = [];
    if (emu.arguments && emu.arguments.trim() !== '') {
      const regex = /[^\s"]+|"([^"]*)"/gi;
      let match;
      while ((match = regex.exec(emu.arguments)) != null) {
        let token = match[1] ? match[1] : match[0];
        // For pure emulator launch without a game, strip out the game_path token entirely if present
        token = token.replace(/{game_path}/g, '');
        if (token.trim() !== '') args.push(token);
      }
    }

    console.log(`[Launcher] Launching Emulator: ${emu.display_name}`);
    console.log(`[Launcher] Executable: ${emu.executable}`);
    console.log(`[Launcher] CWD: ${cwd}`);
    console.log(`[Launcher] Args: ${JSON.stringify(args)}`);

    return new Promise((resolve, reject) => {
      try {
        const isBatch = emu.executable.toLowerCase().endsWith('.bat') || emu.executable.toLowerCase().endsWith('.cmd');
        
        const child = spawn(emu.executable, args, {
          cwd: cwd,
          detached: true,
          shell: isBatch,
          stdio: 'ignore'
        });

        let hasErrored = false;

        child.on('error', (err) => {
          hasErrored = true;
          console.error(`[Launcher] Spawn error for ${emu.display_name}:`, err);
          reject(new Error(`Failed to launch emulator: ${err.message}`));
        });

        setTimeout(() => {
          if (!hasErrored) {
            child.unref();
            resolve({ success: true, message: `Launched ${emu.display_name}` });
          }
        }, 800);

      } catch (error) {
        console.error(`[Launcher] Failed to launch ${emu.display_name}:`, error);
        reject(new Error(`Failed to launch emulator: ${error.message}`));
      }
    });
  }
}

module.exports = new LauncherService();
