import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import GameEditor from '../../components/GameEditor/GameEditor';
import './GamesPage.css';

export default function GamesPage({ 
  searchQuery, 
  sortBy, 
  favoritesFirst, 
  groupPlatforms, 
  hideNoArt, 
  tileSize 
}) {
  const [games, setGames] = useState([]);
  const [emulators, setEmulators] = useState([]);
  const [loading, setLoading] = useState(true);

  // Interaction State
  const [focusedGame, setFocusedGame] = useState(null);
  const [editingGame, setEditingGame] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const loadData = useCallback(async () => {
    if (!window.arcadiaAPI) return;
    const res = await window.arcadiaAPI.games.getAll();
    if (res.success) {
      setGames(res.data);
    }
    const emuRes = await window.arcadiaAPI.emulators.getAll();
    if (emuRes.success) setEmulators(emuRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Keep focus on first item when loaded
  useEffect(() => {
    if (games.length > 0 && !focusedGame) {
      // Find the first valid item according to current filters/sort
      // For now just taking first available isn't perfect if filtered out, 
      // but spatial nav handles it later
    }
  }, [games, focusedGame]);

  const handleTileClick = async (game) => {
    if (!window.arcadiaAPI) return;
    try {
      const res = await window.arcadiaAPI.launcher.launchGame(game.id);
      if (!res.success) {
        alert('Launch Error: ' + res.error);
      }
    } catch (err) {
      alert('Launch Error: ' + err.message);
    }
    loadData();
  };

  const handleToggleFav = async () => {
    if (!focusedGame || !window.arcadiaAPI) return;
    const res = await window.arcadiaAPI.games.toggleFavorite(focusedGame.id);
    if (res.success) loadData();
  };

  const handleRemove = async () => {
    if (!focusedGame || !window.arcadiaAPI) return;
    if (!confirm(`Remove "${focusedGame.display_name}" from library?\n\nThis only removes it from Arcadia.`)) return;
    await window.arcadiaAPI.games.remove(focusedGame.id);
    setFocusedGame(null);
    loadData();
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

  const renderTile = (game) => {
    const isFocused = focusedGame && focusedGame.id === game.id;
    const iconSrc = game.icon_path ? `file://${game.icon_path.replace(/\\/g, '/')}` : null;

    return (
      <div
        key={game.id}
        className={`game-tile size-${tileSize} ${isFocused ? 'focused' : ''}`}
        tabIndex={0}
        onClick={() => handleTileClick(game)}
        onFocus={() => setFocusedGame(game)}
        onMouseEnter={() => setFocusedGame(game)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { 
            e.preventDefault(); 
            handleTileClick(game); 
          }
        }}
      >
        <div className="game-tile-cover-wrap">
          {iconSrc ? (
            <img src={iconSrc} alt={game.display_name} draggable={false} loading="lazy" />
          ) : (
            <div className="game-tile-placeholder">🎮</div>
          )}
          {game.favorite && <span className="game-tile-fav">⭐</span>}
          <span className="game-tile-platform">{game.platform}</span>
        </div>
        <div className="game-tile-name">{game.display_name}</div>
        
        {isFocused && (
          <div className="tile-action-column">
            <button className="tile-action-btn" onClick={(e) => { e.stopPropagation(); handleToggleFav(); }}>
              {game.favorite ? '★ Unfavorite' : '☆ Favorite'}
            </button>
            <button className="tile-action-btn" onClick={(e) => { e.stopPropagation(); setEditingGame(game); setIsEditing(true); }}>
              ✏ Edit
            </button>
            <button className="tile-action-btn danger" onClick={(e) => { e.stopPropagation(); handleRemove(); }}>
              ✕ Remove
            </button>
          </div>
        )}
      </div>
    );
  };

  // ----- Filtering & Sorting Engine -----
  const processedLibrary = useMemo(() => {
    let filtered = games;
    
    // 1. Hide No Art
    if (hideNoArt) filtered = filtered.filter(g => g.icon_path);

    // 2. Search Metadata Index
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(g => {
        const textBlob = [
          g.display_name, g.platform, g.developer, g.publisher, 
          g.genre?.join(' '), g.tags?.join(' '), g.emulator_id
        ].join(' ').toLowerCase();
        return textBlob.includes(q);
      });
    }

    // 3. Sort
    filtered.sort((a, b) => {
      // Favorites First rule supersedes base sort if enabled
      if (favoritesFirst) {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
      }
      
      switch (sortBy) {
        case 'recent_played':
          return new Date(b.last_played || 0) - new Date(a.last_played || 0);
        case 'recent_added':
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        case 'platform':
          return a.platform.localeCompare(b.platform) || a.display_name.localeCompare(b.display_name);
        case 'name_asc':
        default:
          return a.display_name.localeCompare(b.display_name);
      }
    });

    return filtered;
  }, [games, searchQuery, hideNoArt, favoritesFirst, sortBy]);

  // Grouping
  const libraryGroups = useMemo(() => {
    if (!groupPlatforms) return { 'All Games': processedLibrary };
    
    const groups = {};
    for (const g of processedLibrary) {
      if (!groups[g.platform]) groups[g.platform] = [];
      groups[g.platform].push(g);
    }
    // Sort groups alphabetically
    const sortedGroups = {};
    Object.keys(groups).sort().forEach(k => { sortedGroups[k] = groups[k]; });
    return sortedGroups;
  }, [processedLibrary, groupPlatforms]);

  if (!loading && games.length === 0) {
    return (
      <div className="games-page">
        <div className="games-empty">
          <div className="games-empty-icon">🎮</div>
          <div className="games-empty-title">Your library is empty</div>
          <div className="games-empty-sub">Go to Settings to add Library Locations and scan your folders.</div>
        </div>
      </div>
    );
  }

  const bgSrc = focusedGame?.background_path ? `file://${focusedGame.background_path.replace(/\\/g, '/')}` : null;

  return (
    <div className="games-page">
      {/* Global Background */}
      {bgSrc && (
        <div className="global-hero-bg">
          <img src={bgSrc} alt="" />
          <div className="global-hero-overlay"></div>
        </div>
      )}

      <div className="library-content-area">
        <div className="library-grids">
          {Object.entries(libraryGroups).map(([groupName, groupGames]) => (
            groupGames.length > 0 && (
              <div key={groupName} className="library-group">
                {groupPlatforms && <h2 className="section-label">{groupName}</h2>}
                <div className="tile-grid">
                  {groupGames.map(renderTile)}
                  {(!groupPlatforms && groupName === 'All Games') && (
                    <button className={`game-tile size-${tileSize} tile-add`} tabIndex={0} onClick={() => {setEditingGame(null); setIsEditing(true);}}>
                      <span className="tile-add-icon">+</span>
                      Add Game
                    </button>
                  )}
                </div>
              </div>
            )
          ))}
          {processedLibrary.length === 0 && <div style={{padding: '40px', color: 'var(--text-muted)'}}>No games match your search/filters.</div>}
        </div>
      </div>

      {isEditing && <GameEditor game={editingGame} emulators={emulators} onClose={() => setIsEditing(false)} onSave={handleSaveGame} />}
    </div>
  );
}
