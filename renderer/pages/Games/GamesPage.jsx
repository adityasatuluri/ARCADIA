import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import GameEditor from '../../components/GameEditor/GameEditor';
import { useToast } from '../../components/Toast/ToastProvider';
import './GamesPage.css';
import defaultBg from '../../assets/background.png';

export default function GamesPage({ 
  searchQuery, 
  sortBy, 
  favoritesFirst, 
  groupPlatforms, 
  hideNoArt, 
  tileSize 
}) {
  const { addToast } = useToast();
  const [games, setGames] = useState([]);
  const [emulators, setEmulators] = useState([]);
  const [loading, setLoading] = useState(true);

  // Interaction State
  const [focusedGame, setFocusedGame] = useState(null);
  const [trackAnchorId, setTrackAnchorId] = useState(null);
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
    }
  }, [games, focusedGame]);

  // Patch all .game-tile focus methods to prevent the browser's instant native scroll jump
  useEffect(() => {
    const tiles = document.querySelectorAll('.game-tile');
    tiles.forEach(t => {
      if (!t.dataset.patchedFocus) {
        const originalFocus = t.focus.bind(t);
        t.focus = (options) => {
          try {
            originalFocus({ ...(options || {}), preventScroll: true });
          } catch (e) {
            originalFocus();
          }
        };
        t.dataset.patchedFocus = true;
      }
    });
  });

  const handleTileClick = async (game) => {
    if (!window.arcadiaAPI) return;
    try {
      const res = await window.arcadiaAPI.launcher.launch(game.id);
      if (!res.success) {
        addToast('Launch Failed', res.error || 'Unknown error occurred.', 'error');
      } else {
        loadData();
      }
    } catch (e) {
      addToast('Launch Failed', e.message, 'error');
    }
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
    addToast('Game Removed', `"${focusedGame.display_name}" has been removed.`, 'info');
    setFocusedGame(null);
    loadData();
  };

  const handleSaveGame = async (gameData) => {
    if (!window.arcadiaAPI) return;
    const isNew = !gameData.id;
    const res = await window.arcadiaAPI.games.upsert(gameData);
    if (res.success) {
      setIsEditing(false);
      loadData();
      setFocusedGame(res.data);
      addToast(isNew ? 'Game Added' : 'Game Saved', `"${res.data.display_name}" configured successfully.`, 'success');
    } else {
      addToast('Configuration Error', res.error, 'error');
    }
  };

  const handleFocus = (game, e) => {
    setFocusedGame(game);
    setTrackAnchorId(game ? game.id : null);
  };

  const renderTile = (game) => {
    const isFocused = focusedGame && focusedGame.id === game.id;
    const iconSrc = game.icon_path ? `file://${game.icon_path.replace(/\\/g, '/')}` : null;

    return (
      <div
        key={game.id}
        className={`game-tile ${isFocused ? 'focused size-md' : 'size-sm'}`}
        tabIndex={0}
        onClick={() => handleTileClick(game)}
        onFocus={(e) => handleFocus(game, e)}
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
        
        {isFocused && (
          <div className="tile-action-column">
            <button className="tile-action-btn" onClick={(e) => { e.stopPropagation(); handleToggleFav(); }}>
              {game.favorite ? '★ Unfav' : '☆ Fav'}
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

  const displayGame = focusedGame;
  const bgSrc = displayGame?.background_path ? `file://${displayGame.background_path.replace(/\\/g, '/')}` : defaultBg;

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
          {Object.entries(libraryGroups).map(([groupName, groupGames]) => {
            if (groupGames.length === 0) return null;
            
            const hasAddGame = !groupPlatforms && groupName === 'All Games';
            let activeIndex = -1;
            
            if (!trackAnchorId && hasAddGame) {
              activeIndex = 0;
            } else if (trackAnchorId) {
              const idx = groupGames.findIndex(g => g.id === trackAnchorId);
              if (idx !== -1) {
                activeIndex = hasAddGame ? idx + 1 : idx;
              }
            }
            
            // Base offset 64px from the left edge. Tile width 100px + 16px gap = 116px per step.
            const translateX = activeIndex !== -1 ? `calc(64px - ${activeIndex * 116}px)` : '64px';

            return (
              <div key={groupName} className="library-group">
                {groupPlatforms && <h2 className="section-label" style={{marginLeft: '24px'}}>{groupName}</h2>}
                <div 
                  className="tile-grid-horizontal"
                  style={{ 
                    transform: `translateX(${translateX})`, 
                    transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)' 
                  }}
                >
                  {hasAddGame && (
                    <button autoFocus className={`game-tile tile-add ${!focusedGame ? 'focused size-md' : 'size-sm'}`} tabIndex={0} onClick={() => {setEditingGame(null); setIsEditing(true);}} onFocus={(e) => handleFocus(null, e)} onMouseEnter={() => setFocusedGame(null)}>
                      <span className="tile-add-icon">+</span>
                      {(!focusedGame) && <span>Add Game</span>}
                    </button>
                  )}
                  {groupGames.map(renderTile)}
                </div>
              </div>
            );
          })}
          {processedLibrary.length === 0 && <div style={{padding: '40px', color: 'var(--text-muted)'}}>No games match your search/filters.</div>}
        </div>
      </div>
      
      {/* Lower Details Area */}
      {displayGame && (
        <div className="focused-game-footer">
          <h2 className="focused-game-title">{displayGame.display_name}</h2>
          <div className="focused-game-meta">
            {displayGame.developer && <span>{displayGame.developer}</span>}
            {displayGame.year && <span> • {displayGame.year}</span>}
            {displayGame.genre && displayGame.genre.length > 0 && <span> • {displayGame.genre.join(', ')}</span>}
          </div>
          <p className="focused-game-desc">{displayGame.description || 'No description available.'}</p>
        </div>
      )}
      {!displayGame && !focusedGame && (
        <div className="focused-game-footer">
          <h2 className="focused-game-title">Add a Game</h2>
          <p className="focused-game-desc">Manually configure a new PC game or emulator game.</p>
        </div>
      )}

      {isEditing && <GameEditor game={editingGame} emulators={emulators} onClose={() => setIsEditing(false)} onSave={handleSaveGame} />}
    </div>
  );
}
