import React, { useState, useEffect, useRef, useCallback } from 'react';
import GameEditor from '../../components/GameEditor/GameEditor';
import './GamesPage.css';

export default function GamesPage() {
  const [games, setGames] = useState([]);
  const [emulators, setEmulators] = useState([]);
  const [focusedGame, setFocusedGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingGame, setEditingGame] = useState(null);
  const rowRef = useRef(null);

  const loadData = useCallback(async () => {
    if (!window.arcadiaAPI) return;
    
    // Load Emulators
    const emuRes = await window.arcadiaAPI.emulators.getAll();
    if (emuRes.success) setEmulators(emuRes.data);

    // Load Games
    const res = await window.arcadiaAPI.games.getAll();
    if (res.success) {
      setGames(res.data);
      if (res.data.length > 0) {
        setFocusedGame(prev => prev ? res.data.find(g => g.id === prev.id) || res.data[0] : res.data[0]);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Derived lists ---
  const recentGames = games
    .filter(g => g.last_played)
    .sort((a, b) => new Date(b.last_played) - new Date(a.last_played))
    .slice(0, 12);

  const allGames = games;

  // --- Handlers ---
  const handleTileClick = async (game) => {
    console.log('[GamesPage] Launching:', game.display_name);
    if (!window.arcadiaAPI) return;

    try {
      const res = await window.arcadiaAPI.launcher.launch(game.id);
      if (!res.success) {
        alert('Launch Error: ' + res.error);
      }
    } catch (e) {
      alert('Launch Error: ' + e.message);
    }
    
    // Refresh to update play counts/recent games list
    loadData();
  };

  const handleTileFocus = (game) => {
    setFocusedGame(game);
  };

  const handleToggleFav = async () => {
    if (!focusedGame || !window.arcadiaAPI) return;
    const res = await window.arcadiaAPI.games.toggleFavorite(focusedGame.id);
    if (res.success) {
      loadData();
    }
  };

  const handleRemove = async () => {
    if (!focusedGame || !window.arcadiaAPI) return;
    if (!confirm(`Remove "${focusedGame.display_name}" from library?\n\nThis only removes it from Arcadia — your game files are NOT deleted.`)) return;
    await window.arcadiaAPI.games.remove(focusedGame.id);
    setFocusedGame(null);
    loadData();
  };

  const handleEdit = () => {
    setEditingGame(focusedGame);
    setIsEditing(true);
  };

  const handleAdd = () => {
    setEditingGame(null);
    setIsEditing(true);
  };

  const handleSaveGame = async (gameData) => {
    if (!window.arcadiaAPI) return;
    const res = await window.arcadiaAPI.games.upsert(gameData);
    if (res.success) {
      setIsEditing(false);
      loadData();
      setFocusedGame(res.data);
    } else {
      alert('Failed to save game: ' + res.error);
    }
  };

  const handleKeyOnTile = (e, game) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = e.currentTarget.nextElementSibling;
      if (next && next.focus) next.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = e.currentTarget.previousElementSibling;
      if (prev && prev.focus) prev.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTileClick(game);
    }
  };

  const renderTile = (game, index) => {
    const isFocused = focusedGame && focusedGame.id === game.id;
    const iconSrc = game.icon_path ? `file://${game.icon_path.replace(/\\/g, '/')}` : null;

    return (
      <div
        key={game.id}
        className={`game-tile ${isFocused ? 'focused' : ''}`}
        tabIndex={0}
        role="button"
        aria-label={game.display_name}
        onClick={() => handleTileClick(game)}
        onFocus={() => handleTileFocus(game)}
        onMouseEnter={() => handleTileFocus(game)}
        onKeyDown={(e) => handleKeyOnTile(e, game)}
      >
        <div className="game-tile-cover-wrap">
          {iconSrc ? (
            <img src={iconSrc} alt={game.display_name} draggable={false} />
          ) : (
            <div className="game-tile-placeholder">🎮</div>
          )}
          {game.favorite && <span className="game-tile-fav">⭐</span>}
          <span className="game-tile-platform">{game.platform}</span>
        </div>
        <div className="game-tile-name">{game.display_name}</div>
      </div>
    );
  };

  // --- Empty state ---
  if (!loading && games.length === 0) {
    return (
      <div className="games-page">
        <div className="games-empty">
          <div className="games-empty-icon">🎮</div>
          <div className="games-empty-title">Your library is empty</div>
          <div className="games-empty-sub">
            Go to Settings and scan your game directory to discover your games and ROMs.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="games-page">
      {/* Recent Games */}
      {recentGames.length > 0 && (
        <>
          <h2 className="section-label">Recently Played</h2>
          <div className="tile-row hide-scrollbar">
            {recentGames.map(renderTile)}
          </div>
        </>
      )}

      {/* All Games */}
      <h2 className="section-label">All Games</h2>
      <div className="tile-row hide-scrollbar" ref={rowRef}>
        {allGames.map(renderTile)}
        <button className="tile-add" tabIndex={0} onClick={handleAdd}>
          <span className="tile-add-icon">+</span>
          Add Game
        </button>
      </div>

      {/* Focus Details Panel */}
      {focusedGame && (
        <div className="focus-panel" key={focusedGame.id}>
          <div className="focus-cover">
            {focusedGame.icon_path ? (
              <img src={`file://${focusedGame.icon_path.replace(/\\/g, '/')}`} alt="" draggable={false} />
            ) : (
              <div className="game-tile-placeholder" style={{ height: '100%', fontSize: 48 }}>🎮</div>
            )}
          </div>

          <div className="focus-info">
            <div className="focus-title">{focusedGame.display_name}</div>

            <div className="focus-subtitle">
              <span>{focusedGame.platform}</span>
              {focusedGame.year && <span>{focusedGame.year}</span>}
              {focusedGame.developer && <span>{focusedGame.developer}</span>}
              {focusedGame.publisher && focusedGame.publisher !== focusedGame.developer && (
                <span>{focusedGame.publisher}</span>
              )}
            </div>

            {focusedGame.description && (
              <div className="focus-desc">{focusedGame.description}</div>
            )}

            <div className="focus-tags">
              {focusedGame.genre?.map(g => <span key={g} className="focus-tag">{g}</span>)}
              {focusedGame.tags?.map(t => <span key={t} className="focus-tag">{t}</span>)}
            </div>

            <div className="focus-meta">
              <div className="focus-meta-item">
                <div className="focus-meta-label">Type</div>
                <div className="focus-meta-value">{focusedGame.type === 'pc' ? 'PC Game' : 'Emulator Game'}</div>
              </div>
              <div className="focus-meta-item">
                <div className="focus-meta-label">Emulator</div>
                <div className="focus-meta-value">{focusedGame.type === 'pc' ? 'N/A' : (focusedGame.emulator_id || '—')}</div>
              </div>
              <div className="focus-meta-item">
                <div className="focus-meta-label">Save Path</div>
                <div className="focus-meta-value">{focusedGame.save_path || 'Not configured'}</div>
              </div>
              {focusedGame.play_count > 0 && (
                <div className="focus-meta-item">
                  <div className="focus-meta-label">Played</div>
                  <div className="focus-meta-value">{focusedGame.play_count} time{focusedGame.play_count !== 1 ? 's' : ''}</div>
                </div>
              )}
            </div>

            <div className="focus-actions">
              <button className="btn-play" tabIndex={0} onClick={() => handleTileClick(focusedGame)}>
                ▶ Play
              </button>
              <button className="btn-action" tabIndex={0} onClick={handleToggleFav}>
                {focusedGame.favorite ? '★ Unfavorite' : '☆ Favorite'}
              </button>
              <button className="btn-action" tabIndex={0} onClick={handleEdit}>
                ✏ Edit
              </button>
              <button className="btn-action danger" tabIndex={0} onClick={handleRemove}>
                ✕ Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditing && (
        <GameEditor 
          game={editingGame} 
          emulators={emulators} 
          onClose={() => setIsEditing(false)} 
          onSave={handleSaveGame} 
        />
      )}
    </div>
  );
}
