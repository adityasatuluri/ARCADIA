import React, { useState, useEffect } from 'react';
import { useGamepadConfig } from '../../context/GamepadContext';
import './SettingsPage.css';

const CATEGORIES = [
  { id: 'appearance', icon: '🎨', title: 'Appearance', sub: 'Theme, background, UI density' },
  { id: 'emulators', icon: '🕹️', title: 'Emulators', sub: 'Manage, add, platform defaults' },
  { id: 'saves', icon: '💾', title: 'Save Manager', sub: 'Paths, backups, populate' },
  { id: 'artwork', icon: '🖼️', title: 'Artwork & Metadata', sub: 'Covers, cache, auto-detection' },
  { id: 'launch', icon: '🚀', title: 'Launch Behavior', sub: 'Minimize, restore, timeout' },
  { id: 'display', icon: '📊', title: 'Library Display', sub: 'Sorting, grouping, filters' },
  { id: 'search', icon: '🔍', title: 'Search', sub: 'Indexing, metadata fields' },
  { id: 'storage', icon: '💿', title: 'Storage', sub: 'Cache, data, disk usage' },
  { id: 'maintenance', icon: '🔧', title: 'Maintenance', sub: 'Rebuild, validate, rescan' },
  { id: 'notifications', icon: '🔔', title: 'Notifications', sub: 'Event toggles' },
  { id: 'safety', icon: '🛡️', title: 'Safety', sub: 'Confirmations, protections' },
  { id: 'about', icon: 'ℹ️', title: 'About', sub: 'Version, diagnostics, export' }
];

export default function SettingsPage() {
  const [libraryPaths, setLibraryPaths] = useState([]);
  const [scanStatus, setScanStatus] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [progressData, setProgressData] = useState(null);

  // Controller Settings
  const { 
    gamepads, activeGamepadId, setActiveGamepadId,
    analogSensitivity, triggerSensitivity, vibrationEnabled, promptStyle,
    updateConfig, vibrate
  } = useGamepadConfig();

  const [globalSettings, setGlobalSettings] = useState({});

  useEffect(() => {
    async function load() {
      if (window.arcadiaAPI) {
        const libs = await window.arcadiaAPI.settings.get('library_paths');
        if (libs.success && libs.data) setLibraryPaths(libs.data);

        const allSettings = await window.arcadiaAPI.settings.getAll();
        if (allSettings.success && allSettings.data) {
          setGlobalSettings(allSettings.data);
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

  const savePaths = async (newPaths) => {
    setLibraryPaths(newPaths);
    if (window.arcadiaAPI) await window.arcadiaAPI.settings.set('library_locations', newPaths);
  };

  const handleSetGlobalSetting = async (key, value) => {
    if (!window.arcadiaAPI) return;
    await window.arcadiaAPI.settings.set(key, value);
    setGlobalSettings(prev => ({ ...prev, [key]: value }));
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
    
    if (res.success) setScanStatus(`Done — ${res.stats.gamesDiscovered} games, ${res.stats.emulatorsDiscovered} emulators found (${res.stats.filesDiscovered} files crawled)`);
    else setScanStatus(`Error: ${res.error}`);
    setIsScanning(false);
  };

  const cancelScan = async () => {
    if (!window.arcadiaAPI) return;
    await window.arcadiaAPI.scanner.cancel();
    setScanStatus('Scan cancelled.');
    setIsScanning(false);
  };

  return (
    <div className="settings-page">
      <h1 className="settings-header">Settings</h1>

      <div className="library-locations-section">
        <h2 className="section-label" style={{ marginTop: 0 }}>Library Locations</h2>
        <div className="library-card">
          <p className="library-card-desc">Arcadia will scan these folders for games, ROMs, and emulators.</p>
          <div className="library-paths-list">
            {libraryPaths.length === 0 ? (
              <div className="library-path-empty">No library folders configured.</div>
            ) : (
              libraryPaths.map((path, idx) => (
                <div key={idx} className="library-path-item">
                  <span className="library-path-text">{path}</span>
                  <button className="library-path-remove" onClick={() => handleRemoveFolder(path)} tabIndex={0}>✕</button>
                </div>
              ))
            )}
          </div>
          <div className="library-actions">
            <button className="btn-secondary" onClick={handleAddFolder} tabIndex={0}>+ Add Folder</button>
            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
              {isScanning ? (
                <button className="btn-secondary danger" onClick={cancelScan} tabIndex={0}>Cancel Scan</button>
              ) : (
                <button className="btn-primary" onClick={runScan} disabled={libraryPaths.length === 0} tabIndex={0}>
                  {libraryPaths.length > 0 ? 'Start Scan / Rescan' : 'Add a folder to scan'}
                </button>
              )}
            </div>
          </div>
          {(isScanning || scanStatus) && (
            <div className="scanner-progress-box">
              <div className="scanner-status-text">{scanStatus || `Phase: ${progressData?.phase}`}</div>
              {isScanning && progressData && (
                <div className="scanner-stats">
                  <span>Crawling: {progressData.currentLocation || '...'}</span>
                  <div className="scanner-counters">
                    <span>Files: {progressData.filesDiscovered}</span>
                    <span>Games: {progressData.gamesDiscovered}</span>
                    <span>Emulators: {progressData.emulatorsDiscovered}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="library-locations-section" style={{ marginTop: '32px' }}>
        <h2 className="section-label">Controller & Gamepad</h2>
        <div className="library-card">
          <p className="library-card-desc">
            Press any button on your controller to detect it.
          </p>

          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', color: '#fff', marginBottom: '8px' }}>Detected Controllers</h3>
            {gamepads.length === 0 ? (
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                No controllers detected. Press a button to wake your controller.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {gamepads.map(gp => (
                  <div key={gp.index} 
                       style={{ padding: '12px 16px', border: gp.id === activeGamepadId ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)', background: gp.id === activeGamepadId ? 'rgba(var(--accent-rgb), 0.1)' : 'rgba(0,0,0,0.3)', borderRadius: '8px', cursor: 'pointer' }}
                       onClick={() => setActiveGamepadId(gp.id)}
                       tabIndex={0}>
                    <div style={{ fontWeight: '600', color: '#fff' }}>{gp.id.split('(')[0].trim()}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Index: {gp.index} {gp.id === activeGamepadId ? '(Active)' : ''}</div>
                  </div>
                ))}
              </div>
            )}
            {gamepads.length > 0 && (
              <button className="btn-secondary" style={{ marginTop: '12px' }} onClick={() => vibrate(500, 1.0, 1.0)} tabIndex={0}>Test Rumble</button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <h3 style={{ fontSize: '14px', color: '#fff', marginBottom: '16px' }}>Input Sensitivity</h3>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                  Analog Stick Deadzone ({(analogSensitivity * 100).toFixed(0)}%)
                </label>
                <input type="range" min="0" max="1" step="0.05" value={analogSensitivity} onChange={e => updateConfig('analogSensitivity', parseFloat(e.target.value))} style={{ width: '100%' }} tabIndex={0} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                  Trigger Scroll Sensitivity ({(triggerSensitivity * 100).toFixed(0)}%)
                </label>
                <input type="range" min="0" max="1" step="0.05" value={triggerSensitivity} onChange={e => updateConfig('triggerSensitivity', parseFloat(e.target.value))} style={{ width: '100%' }} tabIndex={0} />
              </div>
            </div>
            
            <div>
              <h3 style={{ fontSize: '14px', color: '#fff', marginBottom: '16px' }}>Preferences</h3>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={vibrationEnabled} onChange={e => updateConfig('vibrationEnabled', e.target.checked)} tabIndex={0} />
                  Enable UI Navigation Vibration
                </label>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                  Button Prompts Style
                </label>
                <select value={promptStyle} onChange={e => updateConfig('promptStyle', e.target.value)} style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '4px' }} tabIndex={0}>
                  <option value="xbox">Xbox (A, B, X, Y)</option>
                  <option value="ps">PlayStation (Cross, Circle, Square, Triangle)</option>
                  <option value="generic">Generic (Confirm, Cancel)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="library-locations-section" style={{ marginTop: '32px' }}>
        <h2 className="section-label">Save Backups</h2>
        <div className="library-card">
          <p className="library-card-desc">Configure automatic save backups before launching and after exiting games.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') handleSetGlobalSetting('backup_before_launch', !globalSettings.backup_before_launch) }}>
                <input type="checkbox" checked={globalSettings.backup_before_launch || false} onChange={e => handleSetGlobalSetting('backup_before_launch', e.target.checked)} tabIndex={-1} />
                Backup before launch
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') handleSetGlobalSetting('backup_on_exit', !globalSettings.backup_on_exit) }}>
                <input type="checkbox" checked={globalSettings.backup_on_exit || false} onChange={e => handleSetGlobalSetting('backup_on_exit', e.target.checked)} tabIndex={-1} />
                Backup on game exit
              </label>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                Backup Directory
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  readOnly 
                  value={globalSettings.backup_directory || 'D:/Arcadia/SaveBackups'} 
                  style={{ flex: 1, padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '4px' }} 
                  tabIndex={0} 
                />
                <button 
                  className="btn-secondary" 
                  onClick={async () => {
                    const res = await window.arcadiaAPI.system.showOpenDialog({ properties: ['openDirectory'] });
                    if (res) handleSetGlobalSetting('backup_directory', res);
                  }} 
                  tabIndex={0}
                >
                  Browse...
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="section-label" style={{ marginTop: '32px' }}>Other Categories</h2>
      <div className="settings-grid">
        {CATEGORIES.map(cat => (
          <div key={cat.id} className="settings-card" tabIndex={0}>
            <div className="settings-card-icon">{cat.icon}</div>
            <div className="settings-card-text">
              <div className="settings-card-title">{cat.title}</div>
              <div className="settings-card-sub">{cat.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
