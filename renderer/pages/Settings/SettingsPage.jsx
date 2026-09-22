import React, { useState } from 'react';
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
  const [scanPath, setScanPath] = useState('Z:\\gaming');
  const [scanStatus, setScanStatus] = useState('');

  const runScan = async () => {
    if (!window.arcadiaAPI || !window.arcadiaAPI.scanner) return;
    setScanStatus('Scanning...');
    const res = await window.arcadiaAPI.scanner.start(scanPath);
    if (res.success) {
      const s = res.stats;
      setScanStatus(`Done — ${s.gamesDiscovered} games, ${s.emulatorsDiscovered} emulators found (${s.filesDiscovered} files crawled)`);
    } else {
      setScanStatus(`Error: ${res.error}`);
    }
  };

  return (
    <div className="settings-page">
      <h1 className="settings-header">Settings</h1>

      {/* Quick Scanner (temporarily placed here for testing) */}
      <div className="settings-scanner">
        <div className="settings-scanner-title">Library Scanner</div>
        <div className="settings-scanner-row">
          <input
            className="settings-scanner-input"
            type="text"
            value={scanPath}
            onChange={e => setScanPath(e.target.value)}
            placeholder="Enter directory path to scan..."
            tabIndex={0}
          />
          <button className="settings-scanner-btn" onClick={runScan} tabIndex={0}>
            Start Scan
          </button>
        </div>
        {scanStatus && <div className="settings-scanner-stats">{scanStatus}</div>}
      </div>

      {/* Settings Category Grid */}
      <h2 className="emulators-section-title" style={{ marginTop: 28, marginBottom: 14, fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: 1, textTransform: 'uppercase' }}>
        Categories
      </h2>
      <div className="settings-grid">
        {CATEGORIES.map(cat => (
          <div
            key={cat.id}
            className="settings-card"
            tabIndex={0}
            role="button"
            data-focusable="true"
          >
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
