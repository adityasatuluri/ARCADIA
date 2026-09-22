const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dbService = require('../database/index.js');

class LauncherService {
  constructor() {
    this.activeProcesses = new Map();
  }

  async launch(gameId) {
    const game = dbService.getGameById(gameId);
    if (!game) {
      throw new Error(`Game with ID ${gameId} not found in database.`);
    }

    if (game.type === 'pc') {
      return this._launchPCGame(game);
    } else if (game.type === 'emulator') {
      return this._launchEmulatorGame(game);
    } else {
      throw new Error(`Unknown game type: ${game.type}`);
    }
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
    
    // Replace {game_path} token (handle spaces safely by keeping quotes if present, but child_process spawn array handles quotes automatically, so we just replace the token)
    argsString = argsString.replace(/{game_path}/g, game.game_path || '');
    
    // Split arguments by space but respect quotes
    let args = [];
    if (argsString.trim() !== '') {
      const regex = /[^\s"]+|"([^"]*)"/gi;
      let match;
      while ((match = regex.exec(argsString)) != null) {
        args.push(match[1] ? match[1] : match[0]);
      }
    }
    
    // Append any game-specific arguments if they exist
    if (game.arguments && game.arguments.trim() !== '') {
      const regex = /[^\s"]+|"([^"]*)"/gi;
      let match;
      while ((match = regex.exec(game.arguments)) != null) {
        args.push(match[1] ? match[1] : match[0]);
      }
    }

    console.log(`[Launcher] Launching Emulator Game: ${game.display_name}`);
    console.log(`[Launcher] Emulator: ${emu.display_name}`);
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
          console.error(`[Launcher] Spawn error for ${game.display_name}:`, err);
          reject(new Error(`Failed to launch emulator: ${err.message}`));
        });

        // Timeout checking for synchronous failure bubble up
        setTimeout(() => {
          if (!hasErrored) {
            child.unref();
            this.activeProcesses.set(game.id, child);
            dbService.recordGameLaunch(game.id);
            resolve({ success: true, message: `Launched ${game.display_name} via ${emu.display_name}` });
          }
        }, 800);

      } catch (error) {
        console.error(`[Launcher] Failed to launch ${game.display_name}:`, error);
        reject(new Error(`Failed to launch emulator: ${error.message}`));
      }
    });
  }

  async _launchPCGame(game) {
    if (!game.executable) {
      throw new Error('Executable path is not configured for this game.');
    }

    if (!fs.existsSync(game.executable)) {
      throw new Error(`Executable not found at path: ${game.executable}`);
    }

    let cwd = game.working_directory;
    if (!cwd || cwd.trim() === '') {
      cwd = path.dirname(game.executable);
    }

    if (!fs.existsSync(cwd)) {
      throw new Error(`Working directory not found: ${cwd}`);
    }

    let args = [];
    if (game.arguments && game.arguments.trim() !== '') {
      const regex = /[^\s"]+|"([^"]*)"/gi;
      let match;
      while ((match = regex.exec(game.arguments)) != null) {
        args.push(match[1] ? match[1] : match[0]);
      }
    }

    console.log(`[Launcher] Launching PC Game: ${game.display_name}`);
    console.log(`[Launcher] Executable: ${game.executable}`);
    console.log(`[Launcher] CWD: ${cwd}`);
    console.log(`[Launcher] Args: ${JSON.stringify(args)}`);

    return new Promise((resolve, reject) => {
      try {
        const isBatch = game.executable.toLowerCase().endsWith('.bat') || game.executable.toLowerCase().endsWith('.cmd');
        
        const child = spawn(game.executable, args, {
          cwd: cwd,
          detached: true,
          shell: isBatch,
          stdio: 'ignore'
        });

        let hasErrored = false;

        child.on('error', (err) => {
          hasErrored = true;
          console.error(`[Launcher] Spawn error for ${game.display_name}:`, err);
          reject(new Error(`Failed to launch process: ${err.message}`));
        });

        // Wait a short timeout to ensure the process didn't immediately crash
        setTimeout(() => {
          if (!hasErrored) {
            child.unref();
            this.activeProcesses.set(game.id, child);
            dbService.recordGameLaunch(game.id);
            resolve({ success: true, message: `Launched ${game.display_name}` });
          }
        }, 800);

      } catch (error) {
        console.error(`[Launcher] Failed to launch ${game.display_name}:`, error);
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
        args.push(match[1] ? match[1] : match[0]);
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
