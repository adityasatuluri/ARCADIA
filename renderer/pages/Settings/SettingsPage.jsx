import React, { useState, useEffect } from 'react';
import './SettingsPage.css';

const CATEGORIES = [
  { id: 'appearance', icon: '🎨', title: 'Appearance', sub: 'Theme, background, UI density' },
  { id: 'controller', icon: '🎮', title: 'Controller', sub: 'Gamepad, mapping, sensitivity' },
  { id: 'emulators', icon: '🕹️', title: 'Emulators', sub: 'Manage, add, platform defaults' },
  { id: 'library', icon: '📁', title: 'Game Library', sub: 'Folders, scanning, detection' },
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

  useEffect(() => {
    // Load library paths from settings
    if (!window.arcadiaAPI) return;
    
    window.arcadiaAPI.settings.getAll().then(res => {
      if (res.success && res.data && res.data.library_locations) {
        setLibraryPaths(res.data.library_locations);
      }
    });

    // Listen to progress
    const unsubscribe = window.arcadiaAPI.scanner.onProgress((data) => {
      setProgressData(data);
    });
    return unsubscribe;
  }, []);

  const savePaths = async (newPaths) => {
    setLibraryPaths(newPaths);
    if (window.arcadiaAPI) {
      await window.arcadiaAPI.settings.set('library_locations', newPaths);
    }
  };

  const handleAddFolder = async () => {
    if (!window.arcadiaAPI) return;
    const path = await window.arcadiaAPI.system.showOpenDialog({ properties: ['openDirectory'] });
    if (path && !libraryPaths.includes(path)) {
      const newPaths = [...libraryPaths, path];
      savePaths(newPaths);
    }
  };

  const handleRemoveFolder = (pathToRemove) => {
    const newPaths = libraryPaths.filter(p => p !== pathToRemove);
    savePaths(newPaths);
  };

  const runScan = async () => {
    if (!window.arcadiaAPI || libraryPaths.length === 0) return;
    setIsScanning(true);
    setScanStatus('Scanning libraries...');
    setProgressData({ phase: 'scanning', filesDiscovered: 0, gamesDiscovered: 0, emulatorsDiscovered: 0, currentLocation: '' });
    
    const res = await window.arcadiaAPI.scanner.start(libraryPaths);
    
    if (res.success) {
      const s = res.stats;
      setScanStatus(`Done — ${s.gamesDiscovered} games, ${s.emulatorsDiscovered} emulators found (${s.filesDiscovered} files crawled)`);
    } else {
      setScanStatus(`Error: ${res.error}`);
    }
    
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
          <p className="library-card-desc">
            Arcadia will scan these folders for games, ROMs, and emulators. Missing games will be automatically removed from the database during a scan.
          </p>
          
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
            <button className="btn-secondary" onClick={handleAddFolder} tabIndex={0}>
              + Add Folder
            </button>
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

          {/* Scanner Progress UI */}
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

      <h2 className="section-label">All Categories</h2>
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
