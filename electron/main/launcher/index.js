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
      throw new Error('Emulator launching is not implemented in this stage.');
    } else {
      throw new Error(`Unknown game type: ${game.type}`);
    }
  }

  _launchPCGame(game) {
    if (!game.executable) {
      throw new Error('Executable path is not configured for this game.');
    }

    // Verify invalid executable paths
    if (!fs.existsSync(game.executable)) {
      throw new Error(`Executable not found at path: ${game.executable}`);
    }

    let cwd = game.working_directory;
    if (!cwd || cwd.trim() === '') {
      cwd = path.dirname(game.executable);
    }

    let args = [];
    if (game.arguments && game.arguments.trim() !== '') {
      // Split arguments by space but respect quotes
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

    try {
      const isBatch = game.executable.toLowerCase().endsWith('.bat') || game.executable.toLowerCase().endsWith('.cmd');
      
      const child = spawn(game.executable, args, {
        cwd: cwd,
        detached: true, // Allow it to run independently of the Electron process
        shell: isBatch,
        stdio: 'ignore'
      });

      child.unref(); // Prevent parent from waiting for child to exit
      
      this.activeProcesses.set(game.id, child);
      
      // Record launch in DB
      dbService.recordGameLaunch(game.id);

      return { success: true, message: `Launched ${game.display_name}` };
    } catch (error) {
      console.error(`[Launcher] Failed to launch ${game.display_name}:`, error);
      throw new Error(`Failed to launch process: ${error.message}`);
    }
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

    try {
      const isBatch = emu.executable.toLowerCase().endsWith('.bat') || emu.executable.toLowerCase().endsWith('.cmd');
      
      const child = spawn(emu.executable, args, {
        cwd: cwd,
        detached: true,
        shell: isBatch,
        stdio: 'ignore'
      });

      child.unref();
      return { success: true, message: `Launched ${emu.display_name}` };
    } catch (error) {
      console.error(`[Launcher] Failed to launch ${emu.display_name}:`, error);
      throw new Error(`Failed to launch emulator: ${error.message}`);
    }
  }
}

module.exports = new LauncherService();
