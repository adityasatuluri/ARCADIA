import React, { useState, useEffect } from 'react';
import './EmulatorsPage.css';

export default function EmulatorsPage() {
  const [emulators, setEmulators] = useState([]);
  const [focusedEmu, setFocusedEmu] = useState(null);

  useEffect(() => {
    async function load() {
      if (window.arcadiaAPI && window.arcadiaAPI.emulators) {
        const res = await window.arcadiaAPI.emulators.getAll();
        if (res.success) {
          setEmulators(res.data);
          if (res.data.length > 0) setFocusedEmu(res.data[0]);
        }
      }
    }
    load();
  }, []);

  const handleKeyOnCard = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = e.currentTarget.nextElementSibling;
      if (next && next.focus) next.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = e.currentTarget.previousElementSibling;
      if (prev && prev.focus) prev.focus();
    }
  };

  if (emulators.length === 0) {
    return (
      <div className="emulators-page">
        <div className="emulators-empty">
          <div className="emulators-empty-icon">🕹️</div>
          <div className="emulators-empty-title">No emulators registered</div>
          <div className="emulators-empty-sub">
            Scan your emulator directories or add emulators manually to get started.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="emulators-page">
      <h2 className="emulators-section-title">Emulators</h2>

      {/* Horizontal row of emulator cards */}
      <div className="emulators-row hide-scrollbar">
        {emulators.map((emu) => (
          <div
            key={emu.id}
            className="emu-card"
            tabIndex={0}
            onFocus={() => setFocusedEmu(emu)}
            onMouseEnter={() => setFocusedEmu(emu)}
            onKeyDown={handleKeyOnCard}
            data-focusable="true"
          >
            <div className="emu-card-icon">
              {emu.icon ? (
                <img src={`file://${emu.icon}`} alt={emu.display_name} />
              ) : (
                <span className="emu-card-icon-placeholder">🎮</span>
              )}
            </div>
            <div className="emu-card-name">{emu.display_name}</div>
          </div>
        ))}
        <div className="emu-card" style={{ flexShrink: 0 }}>
          <button className="emu-card-add" tabIndex={0}>
            <span className="emu-card-add-icon">+</span>
            Add Emulator
          </button>
        </div>
      </div>

      {/* Focus Details Panel */}
      {focusedEmu && (
        <div className="emu-focus-panel" key={focusedEmu.id}>
          <div className="emu-focus-left">
            <div className="emu-focus-header">
              <div className="emu-focus-header-icon">
                {focusedEmu.icon ? (
                  <img src={`file://${focusedEmu.icon}`} alt="" />
                ) : (
                  <span style={{ fontSize: 28 }}>🎮</span>
                )}
              </div>
              <div>
                <div className="emu-focus-title">{focusedEmu.display_name}</div>
                <div className="emu-focus-platform">{focusedEmu.platform}</div>
              </div>
            </div>

            {focusedEmu.notes && (
              <div className="emu-focus-desc">{focusedEmu.notes}</div>
            )}

            <div className="emu-focus-tags">
              {focusedEmu.platform && <span className="emu-focus-tag">{focusedEmu.platform}</span>}
            </div>

            <div className="emu-focus-actions">
              <button className="btn-play" tabIndex={0}>▶ Open Emulator</button>
              <button className="btn-secondary" tabIndex={0}>⚙ Settings</button>
              <button className="btn-secondary" tabIndex={0}>⋯</button>
            </div>
          </div>

          <div className="emu-focus-right">
            <div className="emu-info-row">
              <div>
                <div className="emu-info-label">Version</div>
                <div className="emu-info-value">{focusedEmu.version || 'Unknown'}</div>
              </div>
            </div>
            <div className="emu-info-row">
              <div>
                <div className="emu-info-label">Executable Path</div>
                <div className="emu-info-value">{focusedEmu.executable}</div>
              </div>
            </div>
            <div className="emu-info-row">
              <div>
                <div className="emu-info-label">Working Directory</div>
                <div className="emu-info-value">{focusedEmu.working_directory || '—'}</div>
              </div>
            </div>

            <div className="emu-status">
              <div className={`emu-status-dot ${focusedEmu.executable ? 'ready' : 'missing'}`}></div>
              <div className="emu-status-text">
                {focusedEmu.executable ? 'Emulator is configured' : 'Executable not found'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
