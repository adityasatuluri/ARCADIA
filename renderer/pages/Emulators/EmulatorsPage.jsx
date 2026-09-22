import React, { useState, useEffect, useCallback } from 'react';
import EmulatorEditor from '../../components/EmulatorEditor/EmulatorEditor';
import './EmulatorsPage.css';

export default function EmulatorsPage() {
  const [emulators, setEmulators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingEmu, setEditingEmu] = useState(null);

  const loadData = useCallback(async () => {
    if (!window.arcadiaAPI) return;
    const res = await window.arcadiaAPI.emulators.getAll();
    if (res.success) {
      setEmulators(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOpen = async (e, emu) => {
    e.stopPropagation();
    if (!window.arcadiaAPI) return;
    try {
      const res = await window.arcadiaAPI.launcher.launchEmulator(emu.id);
      if (!res.success) {
        alert('Launch Error: ' + res.error);
      }
    } catch (err) {
      alert('Launch Error: ' + err.message);
    }
  };

  const handleEdit = (e, emu) => {
    e.stopPropagation();
    setEditingEmu(emu);
    setIsEditing(true);
  };

  const handleAdd = () => {
    setEditingEmu(null);
    setIsEditing(true);
  };

  const handleRemove = async (e, emu) => {
    e.stopPropagation();
    if (!window.arcadiaAPI) return;
    if (!confirm(`Unregister emulator "${emu.display_name}"?\n\nYour actual emulator files will NOT be deleted.`)) return;
    
    await window.arcadiaAPI.emulators.remove(emu.id);
    loadData();
  };

  const handleSave = async (emuData) => {
    if (!window.arcadiaAPI) return;
    const res = await window.arcadiaAPI.emulators.upsert(emuData);
    if (res.success) {
      setIsEditing(false);
      loadData();
    } else {
      alert('Failed to save emulator: ' + res.error);
    }
  };

  if (loading) return null;

  return (
    <div className="emulators-page">
      <h2 className="section-label">Your Emulators</h2>
      
      <div className="emu-grid">
        {emulators.map(emu => {
          const iconSrc = emu.icon_path ? `file://${emu.icon_path.replace(/\\/g, '/')}` : null;
          // Simple validation assumption for display purposes (real validation happens on launch)
          const isConfigured = Boolean(emu.executable);
          
          return (
            <div key={emu.id} className="emu-card" tabIndex={0} onClick={(e) => handleEdit(e, emu)}>
              <div className="emu-header">
                <div className="emu-icon">
                  {iconSrc ? <img src={iconSrc} alt="" draggable="false"/> : '⚙'}
                </div>
                <div className="emu-title-group">
                  <div className="emu-name">{emu.display_name}</div>
                  <div className="emu-platform">{emu.platform} {emu.is_default ? '(Default)' : ''}</div>
                </div>
              </div>
              
              <div className="emu-meta">
                <div className="emu-meta-item">
                  <span className="emu-meta-label">Version</span>
                  <span className="emu-meta-val">{emu.version || 'Unknown'}</span>
                </div>
                <div className="emu-meta-item">
                  <span className="emu-meta-label">Games</span>
                  <span className="emu-meta-val">{emu.game_count || 0}</span>
                </div>
                <div className="emu-meta-item" style={{ gridColumn: 'span 2' }}>
                  <span className="emu-meta-label">Executable</span>
                  <span className={`emu-meta-val ${isConfigured ? 'status-ok' : 'status-err'}`}>
                    {isConfigured ? 'Configured' : 'Missing Path'}
                  </span>
                </div>
              </div>
              
              <div className="emu-actions">
                <button className="btn-open" onClick={(e) => handleOpen(e, emu)} tabIndex={0}>
                  ▶ Open
                </button>
                <button className="btn-secondary" onClick={(e) => handleEdit(e, emu)} tabIndex={0}>
                  ✏ Edit
                </button>
                <button className="btn-secondary danger" onClick={(e) => handleRemove(e, emu)} tabIndex={0}>
                  ✕ Remove
                </button>
              </div>
            </div>
          );
        })}

        <button className="emu-card emu-card-add" onClick={handleAdd} tabIndex={0}>
          <span className="emu-add-icon">+</span>
          Add Emulator
        </button>
      </div>

      {isEditing && (
        <EmulatorEditor 
          emulator={editingEmu} 
          onClose={() => setIsEditing(false)} 
          onSave={handleSave} 
        />
      )}
    </div>
  );
}
