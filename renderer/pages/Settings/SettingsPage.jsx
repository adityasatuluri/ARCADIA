import React, { useState, useEffect, useCallback } from 'react';
import { useGamepadConfig } from '../../context/GamepadContext';
import { useTheme } from '../../theme/ThemeContext';
import { useToast } from '../../components/Toast/ToastProvider';
import {
  Palette, Gamepad2, Joystick, FolderOpen, Save,
  Image as ImageIcon, Rocket, Monitor, Search,
  HardDrive, Wrench, Bell, Shield, Info
} from 'lucide-react';
import './SettingsPage.css';

const CATEGORIES = [
  { id: 'appearance', icon: <Palette size={20} />, title: 'Appearance' },
  { id: 'controller', icon: <Gamepad2 size={20} />, title: 'Controller' },
  { id: 'emulators', icon: <Joystick size={20} />, title: 'Emulators' },
  { id: 'library', icon: <FolderOpen size={20} />, title: 'Game Library' },
  { id: 'saves', icon: <Save size={20} />, title: 'Save Manager' },
  { id: 'artwork', icon: <ImageIcon size={20} />, title: 'Artwork & Metadata' },
  { id: 'launch', icon: <Rocket size={20} />, title: 'Launch Behavior' },
  { id: 'display', icon: <Monitor size={20} />, title: 'Library Display' },
  { id: 'search', icon: <Search size={20} />, title: 'Search' },
  { id: 'storage', icon: <HardDrive size={20} />, title: 'Storage' },
  { id: 'maintenance', icon: <Wrench size={20} />, title: 'Maintenance' },
  { id: 'notifications', icon: <Bell size={20} />, title: 'Notifications' },
  { id: 'safety', icon: <Shield size={20} />, title: 'Safety' },
  { id: 'about', icon: <Info size={20} />, title: 'About' }
];

export default function SettingsPage() {
  const { addToast } = useToast();
  const [activeCategory, setActiveCategory] = useState('appearance');
  const [libraryPaths, setLibraryPaths] = useState([]);
  const [scanStatus, setScanStatus] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [progressData, setProgressData] = useState(null);
  
  const { theme, toggleTheme } = useTheme();

  // Controller Settings
  const { 
    gamepads, activeGamepadId, setActiveGamepadId,
    analogSensitivity, triggerSensitivity, vibrationEnabled, promptStyle,
    updateConfig, vibrate
  } = useGamepadConfig();

  const [settings, setSettings] = useState({
    theme: 'dark',
    ui_scale: '100%',
    accent_color: 'blue',
    minimize_on_launch: true,
    restore_on_exit: true,
    auto_download_covers: true,
    scrape_metadata: true,
    default_sort: 'name_asc',
    fuzzy_search: true,
    show_toasts: true,
    confirm_delete: true,
    confirm_launch_no_save: false,
    backup_before_launch: false,
    backup_on_exit: false,
    backup_directory: 'D:/Arcadia/SaveBackups',
  });

  useEffect(() => {
    async function load() {
      if (window.arcadiaAPI) {
        const libs = await window.arcadiaAPI.settings.get('library_paths');
        if (libs.success && libs.data) setLibraryPaths(libs.data);

        const allSettings = await window.arcadiaAPI.settings.getAll();
        if (allSettings.success && allSettings.data) {
          setSettings(prev => ({ ...prev, ...allSettings.data }));
          if (allSettings.data.library_locations && (!libs.success || !libs.data)) {
            setLibraryPaths(allSettings.data.library_locations);
          }
        }
      }
    }
    load();

    const unsubscribe = window.arcadiaAPI?.scanner?.onProgress((data) => {
      setProgressData(data);
    });
    
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleSetSetting = async (key, value) => {
    if (!window.arcadiaAPI) return;
    await window.arcadiaAPI.settings.set(key, value);
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const savePaths = async (newPaths) => {
    setLibraryPaths(newPaths);
    if (window.arcadiaAPI) await window.arcadiaAPI.settings.set('library_locations', newPaths);
  };

  const handleAddFolder = async () => {
    if (!window.arcadiaAPI) return;
    const path = await window.arcadiaAPI.system.showOpenDialog({ properties: ['openDirectory'] });
    if (path && !libraryPaths.includes(path)) savePaths([...libraryPaths, path]);
  };

  const handleRemoveFolder = (pathToRemove) => savePaths(libraryPaths.filter(p => p !== pathToRemove));

  const runScan = async () => {
    if (!window.arcadiaAPI || libraryPaths.length === 0) return;
    setIsScanning(true);
    setScanStatus('Scanning libraries...');
    setProgressData({ phase: 'scanning', filesDiscovered: 0, gamesDiscovered: 0, emulatorsDiscovered: 0, currentLocation: '' });
    
    const res = await window.arcadiaAPI.scanner.start(libraryPaths);
    
    if (res.success) {
      setScanStatus(`Done — ${res.stats.gamesDiscovered} games, ${res.stats.emulatorsDiscovered} emulators`);
      addToast('Scan Completed', `Discovered ${res.stats.gamesDiscovered} games and ${res.stats.emulatorsDiscovered} emulators.`, 'success');
    } else {
      setScanStatus(`Error: ${res.error}`);
      addToast('Scan Failed', res.error, 'error');
    }
    setIsScanning(false);
  };

  const cancelScan = async () => {
    if (!window.arcadiaAPI) return;
    await window.arcadiaAPI.scanner.cancel();
    setScanStatus('Scan cancelled.');
    setIsScanning(false);
  };

  const confirmAction = (msg, action) => {
    if (window.confirm(msg)) action();
  };

  const renderContent = () => {
    switch(activeCategory) {
      case 'appearance': return (
        <div className="settings-panel">
          <h2>Appearance</h2>
          <div className="settings-group">
            <label className="settings-row" tabIndex={0} onKeyDown={e => { if(e.key === 'Enter') toggleTheme() }}>
              <span>Theme Mode</span>
              <button className="btn-secondary" onClick={toggleTheme}>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</button>
            </label>
            <label className="settings-row">
              <span>UI Scale</span>
              <select value={settings.ui_scale} onChange={e => handleSetSetting('ui_scale', e.target.value)} tabIndex={0}>
                <option value="90%">90%</option>
                <option value="100%">100%</option>
                <option value="110%">110%</option>
              </select>
            </label>
            <label className="settings-row">
              <span>Accent Color</span>
              <select value={settings.accent_color} onChange={e => handleSetSetting('accent_color', e.target.value)} tabIndex={0}>
                <option value="blue">Blue</option>
                <option value="purple">Purple</option>
                <option value="red">Red</option>
              </select>
            </label>
          </div>
        </div>
      );
      case 'controller': return (
        <div className="settings-panel">
          <h2>Controller</h2>
          <div className="settings-group">
            <div className="settings-row" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '8px'}}>
              <span>Detected Controllers</span>
              {gamepads.length === 0 ? (
                <div style={{color: 'var(--text-muted)'}}>No controllers detected. Press a button.</div>
              ) : (
                <div style={{display: 'flex', gap: '8px'}}>
                  {gamepads.map(gp => (
                    <button key={gp.id} className={gp.id === activeGamepadId ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveGamepadId(gp.id)}>
                      {gp.id.split('(')[0].trim()}
                    </button>
                  ))}
                </div>
              )}
              {gamepads.length > 0 && <button className="btn-secondary" onClick={() => vibrate(500, 1, 1)}>Test Rumble</button>}
            </div>
            
            <label className="settings-row">
              <span>Analog Deadzone ({(analogSensitivity*100).toFixed(0)}%)</span>
              <input type="range" min="0" max="1" step="0.05" value={analogSensitivity} onChange={e => updateConfig('analogSensitivity', parseFloat(e.target.value))} tabIndex={0} />
            </label>
            <label className="settings-row">
              <span>Trigger Sensitivity ({(triggerSensitivity*100).toFixed(0)}%)</span>
              <input type="range" min="0" max="1" step="0.05" value={triggerSensitivity} onChange={e => updateConfig('triggerSensitivity', parseFloat(e.target.value))} tabIndex={0} />
            </label>
            <label className="settings-row" tabIndex={0} onKeyDown={e => { if(e.key === 'Enter') updateConfig('vibrationEnabled', !vibrationEnabled) }}>
              <span>Enable Navigation Vibration</span>
              <input type="checkbox" checked={vibrationEnabled} onChange={e => updateConfig('vibrationEnabled', e.target.checked)} tabIndex={-1} />
            </label>
            <label className="settings-row">
              <span>Button Prompts Style</span>
              <select value={promptStyle} onChange={e => updateConfig('promptStyle', e.target.value)} tabIndex={0}>
                <option value="xbox">Xbox</option>
                <option value="ps">PlayStation</option>
                <option value="generic">Generic</option>
              </select>
            </label>
          </div>
        </div>
      );
      case 'emulators': return (
        <div className="settings-panel">
          <h2>Emulators</h2>
          <div className="settings-group">
            <div className="settings-row" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
              <span>Emulators are detected during Library Scans.</span>
              <p style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px'}}>Configure default emulator mappings for specific platforms here (Coming Soon).</p>
            </div>
          </div>
        </div>
      );
      case 'library': return (
        <div className="settings-panel">
          <h2>Game Library</h2>
          <div className="settings-group">
            <div className="settings-row" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
              <span>Library Locations</span>
              <div className="library-paths-list" style={{width: '100%', marginTop: '8px'}}>
                {libraryPaths.length === 0 ? <div className="library-path-empty">No folders configured.</div> : libraryPaths.map(p => (
                  <div key={p} className="library-path-item">
                    <span>{p}</span>
                    <button className="btn-secondary danger" onClick={() => confirmAction('Remove this folder?', () => handleRemoveFolder(p))}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{display: 'flex', gap: '8px', marginTop: '12px'}}>
                <button className="btn-secondary" onClick={handleAddFolder}>+ Add Folder</button>
                {isScanning ? <button className="btn-secondary danger" onClick={cancelScan}>Cancel Scan</button> : <button className="btn-primary" onClick={runScan}>Start Scan</button>}
              </div>
              {scanStatus && <div style={{marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)'}}>{scanStatus}</div>}
            </div>
          </div>
        </div>
      );
      case 'saves': return (
        <div className="settings-panel">
          <h2>Save Manager</h2>
          <div className="settings-group">
            <label className="settings-row" tabIndex={0} onKeyDown={e => { if(e.key==='Enter') handleSetSetting('backup_before_launch', !settings.backup_before_launch) }}>
              <span>Backup Before Launch</span>
              <input type="checkbox" checked={settings.backup_before_launch} onChange={e => handleSetSetting('backup_before_launch', e.target.checked)} tabIndex={-1} />
            </label>
            <label className="settings-row" tabIndex={0} onKeyDown={e => { if(e.key==='Enter') handleSetSetting('backup_on_exit', !settings.backup_on_exit) }}>
              <span>Backup On Exit</span>
              <input type="checkbox" checked={settings.backup_on_exit} onChange={e => handleSetSetting('backup_on_exit', e.target.checked)} tabIndex={-1} />
            </label>
            <label className="settings-row">
              <span>Backup Directory</span>
              <div style={{display: 'flex', gap: '8px', width: '250px'}}>
                <input type="text" readOnly value={settings.backup_directory} style={{flex: 1, padding: '4px 8px'}} tabIndex={-1} />
                <button className="btn-secondary" onClick={async () => {
                  const res = await window.arcadiaAPI.system.showOpenDialog({ properties: ['openDirectory'] });
                  if (res) handleSetSetting('backup_directory', res);
                }} tabIndex={0}>Browse</button>
              </div>
            </label>
          </div>
        </div>
      );
      case 'artwork': return (
        <div className="settings-panel">
          <h2>Artwork & Metadata</h2>
          <div className="settings-group">
            <label className="settings-row" tabIndex={0} onKeyDown={e => { if(e.key==='Enter') handleSetSetting('auto_download_covers', !settings.auto_download_covers) }}>
              <span>Auto-download missing covers</span>
              <input type="checkbox" checked={settings.auto_download_covers} onChange={e => handleSetSetting('auto_download_covers', e.target.checked)} tabIndex={-1} />
            </label>
            <label className="settings-row" tabIndex={0} onKeyDown={e => { if(e.key==='Enter') handleSetSetting('scrape_metadata', !settings.scrape_metadata) }}>
              <span>Scrape metadata on scan</span>
              <input type="checkbox" checked={settings.scrape_metadata} onChange={e => handleSetSetting('scrape_metadata', e.target.checked)} tabIndex={-1} />
            </label>
          </div>
        </div>
      );
      case 'launch': return (
        <div className="settings-panel">
          <h2>Launch Behavior</h2>
          <div className="settings-group">
            <label className="settings-row" tabIndex={0} onKeyDown={e => { if(e.key==='Enter') handleSetSetting('minimize_on_launch', !settings.minimize_on_launch) }}>
              <span>Minimize Arcadia on game launch</span>
              <input type="checkbox" checked={settings.minimize_on_launch || false} onChange={e => handleSetSetting('minimize_on_launch', e.target.checked)} tabIndex={-1} />
            </label>
            <label className="settings-row" tabIndex={0} onKeyDown={e => { if(e.key==='Enter') handleSetSetting('close_on_launch', !settings.close_on_launch) }}>
              <span>Hide Arcadia when game starts</span>
              <input type="checkbox" checked={settings.close_on_launch || false} onChange={e => handleSetSetting('close_on_launch', e.target.checked)} tabIndex={-1} />
            </label>
            <label className="settings-row" tabIndex={0} onKeyDown={e => { if(e.key==='Enter') handleSetSetting('restore_on_exit', !settings.restore_on_exit) }}>
              <span>Restore Arcadia on game exit</span>
              <input type="checkbox" checked={settings.restore_on_exit ?? true} onChange={e => handleSetSetting('restore_on_exit', e.target.checked)} tabIndex={-1} />
            </label>
            <label className="settings-row">
              <span>Launch Timeout (ms)</span>
              <input type="number" value={settings.launch_timeout || 1500} onChange={e => handleSetSetting('launch_timeout', parseInt(e.target.value) || 1500)} style={{background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', width: '100px'}} tabIndex={0} />
            </label>
            <label className="settings-row">
              <span>Default Launch Arguments</span>
              <input type="text" placeholder="-fullscreen" value={settings.default_launch_arguments || ''} onChange={e => handleSetSetting('default_launch_arguments', e.target.value)} style={{width: '200px'}} tabIndex={0} />
            </label>
          </div>
        </div>
      );
      case 'display': return (
        <div className="settings-panel">
          <h2>Library Display</h2>
          <div className="settings-group">
            <label className="settings-row">
              <span>Default Sorting</span>
              <select value={settings.default_sort} onChange={e => handleSetSetting('default_sort', e.target.value)} tabIndex={0}>
                <option value="name_asc">A-Z</option>
                <option value="recent">Recently Played</option>
              </select>
            </label>
          </div>
        </div>
      );
      case 'search': return (
        <div className="settings-panel">
          <h2>Search</h2>
          <div className="settings-group">
            <label className="settings-row" tabIndex={0} onKeyDown={e => { if(e.key==='Enter') handleSetSetting('fuzzy_search', !settings.fuzzy_search) }}>
              <span>Enable Fuzzy Search</span>
              <input type="checkbox" checked={settings.fuzzy_search} onChange={e => handleSetSetting('fuzzy_search', e.target.checked)} tabIndex={-1} />
            </label>
          </div>
        </div>
      );
      case 'storage': return (
        <div className="settings-panel">
          <h2>Storage</h2>
          <div className="settings-group">
            <div className="settings-row" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
              <span>Artwork Cache</span>
              <p style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px'}}>Clears downloaded thumbnails and background art.</p>
              <button className="btn-secondary danger" style={{marginTop: '8px'}} onClick={() => confirmAction('Rebuild Artwork Cache?', async () => {
                await window.arcadiaAPI.maintenance.rebuildArtwork();
                addToast('Storage', 'Artwork cache rebuilt successfully.', 'success');
              })}>Rebuild Artwork Cache</button>
            </div>
            <div className="settings-row" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
              <span>Arcadia Data Folder</span>
              <p style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px'}}>Open the directory containing your configuration and database.</p>
              <button className="btn-secondary" style={{marginTop: '8px'}} onClick={() => window.arcadiaAPI.system.openDataFolder()}>Open Data Folder</button>
            </div>
          </div>
        </div>
      );
      case 'maintenance': return (
        <div className="settings-panel">
          <h2>Maintenance & Diagnostics</h2>
          <div className="settings-group">
            <div className="settings-row" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
              <span>Library Scanner</span>
              <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                <button className="btn-secondary" onClick={() => confirmAction('Rescan all configured library folders?', runScan)}>Rescan Everything</button>
              </div>
            </div>
            <div className="settings-row" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
              <span>Validation & Diagnostics</span>
              <p style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px'}}>Validates all game configs, emulator executables, and save paths.</p>
              <button className="btn-secondary" style={{marginTop: '8px'}} onClick={async () => {
                const res = await window.arcadiaAPI.maintenance.runDiagnostics();
                if (res.success) {
                  let msg = `Games: ${res.data.totalGames} (Invalid: ${res.data.invalidGames})\nEmulators: ${res.data.totalEmulators} (Invalid: ${res.data.invalidEmulators})\nInvalid Saves: ${res.data.invalidSaves}\n\n`;
                  if (res.data.warnings.length > 0) {
                    msg += "Warnings:\n" + res.data.warnings.slice(0, 10).join('\n');
                    if (res.data.warnings.length > 10) msg += `\n...and ${res.data.warnings.length - 10} more.`;
                  } else {
                    msg += "No issues found!";
                  }
                  // For huge diagnostic reports, window.alert might still be better than a small toast,
                  // but we should adhere to non-blocking UI for normal notifications.
                  // For diagnostics, alert is fine as it's an explicit report read-out,
                  // but we'll show a toast first.
                  addToast('Diagnostics Completed', 'Check the report.', 'info');
                  setTimeout(() => alert(msg), 100);
                }
              }}>Run Diagnostics</button>
            </div>
            <div className="settings-row" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
              <span style={{color: 'var(--accent-danger)'}}>Danger Zone</span>
              <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                <button className="btn-secondary danger" onClick={() => confirmAction('Wipe the database and rescan from scratch? This will clear all favorites and play history.', async () => {
                  setScanStatus('Rebuilding Database...');
                  await window.arcadiaAPI.maintenance.rebuildDatabase();
                  setScanStatus('Database rebuilt successfully.');
                  addToast('Maintenance', 'Database rebuilt successfully.', 'success');
                })}>Rebuild Database</button>
                <button className="btn-secondary danger" onClick={() => confirmAction('Reset all settings to default values?', async () => {
                  await window.arcadiaAPI.system.resetSettings();
                  addToast('Settings Reset', 'Please restart Arcadia.', 'warning');
                })}>Reset Settings</button>
              </div>
            </div>
          </div>
        </div>
      );
      case 'notifications': return (
        <div className="settings-panel">
          <h2>Notifications</h2>
          <div className="settings-group">
            <label className="settings-row" tabIndex={0} onKeyDown={e => { if(e.key==='Enter') handleSetSetting('show_toasts', !settings.show_toasts) }}>
              <span>Show Launch Toasts</span>
              <input type="checkbox" checked={settings.show_toasts} onChange={e => handleSetSetting('show_toasts', e.target.checked)} tabIndex={-1} />
            </label>
          </div>
        </div>
      );
      case 'safety': return (
        <div className="settings-panel">
          <h2>Safety</h2>
          <div className="settings-group">
            <label className="settings-row" tabIndex={0} onKeyDown={e => { if(e.key==='Enter') handleSetSetting('confirm_delete', !settings.confirm_delete) }}>
              <span>Confirm game deletion</span>
              <input type="checkbox" checked={settings.confirm_delete} onChange={e => handleSetSetting('confirm_delete', e.target.checked)} tabIndex={-1} />
            </label>
            <label className="settings-row" tabIndex={0} onKeyDown={e => { if(e.key==='Enter') handleSetSetting('confirm_launch_no_save', !settings.confirm_launch_no_save) }}>
              <span>Confirm launch if missing save</span>
              <input type="checkbox" checked={settings.confirm_launch_no_save} onChange={e => handleSetSetting('confirm_launch_no_save', e.target.checked)} tabIndex={-1} />
            </label>
          </div>
        </div>
      );
      case 'about': return (
        <div className="settings-panel">
          <h2>About Arcadia</h2>
          <div className="settings-group">
            <div className="settings-row" style={{flexDirection: 'column', alignItems: 'flex-start', color: 'var(--text-muted)'}}>
              <span>Arcadia Version 1.0.0</span>
              <span>Advanced Emulator Frontend UI</span>
            </div>
            <div className="settings-row" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
              <span>Configuration Data</span>
              <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                <button className="btn-secondary" onClick={async () => {
                  const targetPath = await window.arcadiaAPI.system.showSaveDialog({ defaultPath: 'arcadia_config.json', filters: [{name: 'JSON', extensions: ['json']}] });
                  if (targetPath) {
                    await window.arcadiaAPI.system.exportConfig(targetPath);
                    addToast('Configuration', 'Configuration exported successfully.', 'success');
                  }
                }}>Export Configuration</button>
                <button className="btn-secondary" onClick={async () => {
                  const sourcePath = await window.arcadiaAPI.system.showOpenDialog({ filters: [{name: 'JSON', extensions: ['json']}] });
                  if (sourcePath) {
                    await window.arcadiaAPI.system.importConfig(sourcePath);
                    addToast('Configuration', 'Configuration imported successfully. Please restart Arcadia.', 'success');
                  }
                }}>Import Configuration</button>
              </div>
            </div>
          </div>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-sidebar">
        <h1 style={{padding: '0 16px 24px', fontSize: '24px'}}>Settings</h1>
        <div className="settings-categories">
          {CATEGORIES.map(cat => (
            <button 
              key={cat.id} 
              className={`settings-cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
              tabIndex={0}
            >
              <span className="settings-cat-icon">{cat.icon}</span>
              <span className="settings-cat-title">{cat.title}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="settings-content">
        {renderContent()}
      </div>
    </div>
  );
}
