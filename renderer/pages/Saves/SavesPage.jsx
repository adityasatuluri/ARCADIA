import React, { useState, useEffect, useCallback } from 'react';
import './SavesPage.css';
import SaveConflictModal from '../../components/SaveConflictModal/SaveConflictModal';

export default function SavesPage({ searchQuery }) {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Conflict modal state
  const [conflictTarget, setConflictTarget] = useState(null); // { id, isPopulate }
  
  const loadData = useCallback(async () => {
    if (!window.arcadiaAPI) return;
    const res = await window.arcadiaAPI.saves.getAllStatuses();
    if (res) {
      setStatuses(res);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleBackup = async (id) => {
    if (!window.arcadiaAPI) return;
    const res = await window.arcadiaAPI.saves.backup(id);
    if (res.success) {
      alert(`Backed up successfully! Copied ${res.files} files.`);
      loadData();
    } else {
      alert('Backup failed: ' + res.error);
    }
  };

  const handleOpenFolder = async (id) => {
    if (!window.arcadiaAPI) return;
    await window.arcadiaAPI.saves.openFolder(id);
  };

  const handlePopulateAll = async () => {
    if (!confirm('Populate ALL configured saves?\n\nThis will look for backups or local source directories and copy them to the game\'s configured save paths.')) return;
    if (!window.arcadiaAPI) return;
    // For simplicity, we just use 'backup_then_replace' for bulk populate
    const res = await window.arcadiaAPI.saves.populateAll('backup_then_replace');
    alert(`Finished bulk populate.\nSuccessful: ${res.success}\nFailed: ${res.failed}`);
    loadData();
  };

  const handleConflictResolve = async (mode) => {
    const target = conflictTarget;
    setConflictTarget(null);
    if (!target || mode === 'cancel' || !window.arcadiaAPI) return;

    if (target.isPopulate) {
      const res = await window.arcadiaAPI.saves.populate(target.id, mode);
      if (res.success) {
        alert('Save populated successfully!');
        loadData();
      } else {
        alert('Failed to populate: ' + res.error);
      }
    }
  };

  const filteredStatuses = React.useMemo(() => {
    if (!searchQuery?.trim()) return statuses;
    const q = searchQuery.toLowerCase();
    return statuses.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.platform.toLowerCase().includes(q)
    );
  }, [statuses, searchQuery]);

  if (loading) return null;

  return (
    <div className="saves-page">
      <div className="saves-header-row">
        <h2 className="section-label">Save Manager</h2>
        <button className="btn-primary" onClick={handlePopulateAll} tabIndex={0}>
          [ POPULATE ALL SAVES ]
        </button>
      </div>

      <div className="saves-list">
        {filteredStatuses.map(s => (
          <div key={s.gameId} className="save-card" tabIndex={0}>
            <div className="save-info">
              <div className="save-name">{s.name}</div>
              <div className="save-meta">
                Platform: {s.platform} | Emulator: {s.emulatorId || 'PC'}
              </div>
              <div className="save-path">
                <span className="path-label">Configured Path:</span> {s.savePath}
              </div>
              <div className="save-status-indicators">
                <span className={`status-badge ${s.exists ? 'status-ok' : 'status-err'}`}>
                  {s.exists ? 'Path Valid' : 'Path Invalid'}
                </span>
                <span className="status-badge">
                  {s.fileCount} Save Files
                </span>
              </div>
            </div>
            
            <div className="save-actions">
              <button 
                className="btn-secondary" 
                onClick={() => setConflictTarget({ id: s.gameId, isPopulate: true })}
                tabIndex={0}
              >
                Populate Save
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => handleBackup(s.gameId)}
                tabIndex={0}
              >
                Backup
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => handleOpenFolder(s.gameId)}
                tabIndex={0}
              >
                Open Backup Folder
              </button>
            </div>
          </div>
        ))}

        {filteredStatuses.length === 0 && (
          <div className="saves-empty">
            No games have a configured `save.path` in their config.json.
          </div>
        )}
      </div>

      {conflictTarget && (
        <SaveConflictModal 
          onResolve={handleConflictResolve}
          title={conflictTarget.isPopulate ? 'Populate Save' : 'Restore Backup'}
        />
      )}
    </div>
  );
}
