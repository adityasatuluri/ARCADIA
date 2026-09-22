import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import GameEditor from '../../components/GameEditor/GameEditor';
import './GamesPage.css';

export default function GamesPage() {
  const [games, setGames] = useState([]);
  const [emulators, setEmulators] = useState([]);
  const [loading, setLoading] = useState(true);

  // Display State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name_asc'); // name_asc, recent_played, recent_added
  const [favoritesFirst, setFavoritesFirst] = useState(true);
  const [groupPlatforms, setGroupPlatforms] = useState(false);
  const [hideNoArt, setHideNoArt] = useState(false);
  const [tileSize, setTileSize] = useState('md'); // sm, md, lg

  // Interaction State
  const [focusedGame, setFocusedGame] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingGame, setEditingGame] = useState(null);

  const loadData = useCallback(async () => {
    if (!window.arcadiaAPI) return;
    const [gamesRes, emuRes] = await Promise.all([
      window.arcadiaAPI.games.getAll(),
      window.arcadiaAPI.emulators.getAll()
    ]);
    
    if (emuRes.success) setEmulators(emuRes.data);
    if (gamesRes.success) {
      setGames(gamesRes.data);
      if (gamesRes.data.length > 0) {
        setFocusedGame(prev => prev ? gamesRes.data.find(g => g.id === prev.id) || gamesRes.data[0] : gamesRes.data[0]);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTileClick = async (game) => {
    if (!window.arcadiaAPI) return;
    try {
      const res = await window.arcadiaAPI.launcher.launch(game.id);
      if (!res.success) alert('Launch Error: ' + res.error);
    } catch (e) {
      alert('Launch Error: ' + e.message);
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
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTileClick(game); }
        }}
      >
        <div className="game-tile-cover-wrap">
          {iconSrc ? (
            <img src={iconSrc} alt={game.display_name} draggable={false} loading="lazy" />
          ) : (
            <div className="game-tile-placeholder">🎮</div>
          )}
          {game.favorite ? <span className="game-tile-fav">⭐</span> : null}
          <span className="game-tile-platform">{game.platform}</span>
        </div>
        <div className="game-tile-name">{game.display_name}</div>
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

  return (
    <div className="games-page">
      
      {/* Search & Filter Top Bar */}
      <div className="library-toolbar">
        <div className="library-search-box">
          <span className="library-search-icon">🔍</span>
          <input 
            type="text" 
            placeholder="Search games, platforms, developers..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="library-controls">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="name_asc">Sort A-Z</option>
            <option value="recent_played">Recently Played</option>
            <option value="recent_added">Recently Added</option>
            <option value="platform">By Platform</option>
          </select>

          <select value={tileSize} onChange={e => setTileSize(e.target.value)}>
            <option value="sm">Small Tiles</option>
            <option value="md">Medium Tiles</option>
            <option value="lg">Large Tiles</option>
          </select>
        </div>

        <div className="library-toggles">
          <label><input type="checkbox" checked={favoritesFirst} onChange={e => setFavoritesFirst(e.target.checked)} /> Favs First</label>
          <label><input type="checkbox" checked={groupPlatforms} onChange={e => setGroupPlatforms(e.target.checked)} /> Group Platforms</label>
          <label><input type="checkbox" checked={hideNoArt} onChange={e => setHideNoArt(e.target.checked)} /> Hide No Art</label>
        </div>
      </div>

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

        {/* Focus Details Panel */}
        {focusedGame && (
          <div className="focus-panel-container">
            <div className="focus-panel" key={focusedGame.id}>
              <div className="focus-cover">
                {focusedGame.icon_path ? (
                  <img src={`file://${focusedGame.icon_path.replace(/\\/g, '/')}`} alt="" draggable={false} loading="lazy" />
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
                </div>
                {focusedGame.description && <div className="focus-desc">{focusedGame.description}</div>}
                
                <div className="focus-tags">
                  {focusedGame.genre?.map(g => <span key={g} className="focus-tag">{g}</span>)}
                  {focusedGame.tags?.map(t => <span key={t} className="focus-tag">{t}</span>)}
                </div>

                <div className="focus-actions">
                  <button className="btn-play" tabIndex={0} onClick={() => handleTileClick(focusedGame)}>▶ Play</button>
                  <button className="btn-action" tabIndex={0} onClick={handleToggleFav}>{focusedGame.favorite ? '★ Unfav' : '☆ Fav'}</button>
                  <button className="btn-action" tabIndex={0} onClick={() => {setEditingGame(focusedGame); setIsEditing(true);}}>✏ Edit</button>
                  <button className="btn-action danger" tabIndex={0} onClick={handleRemove}>✕ Remove</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isEditing && <GameEditor game={editingGame} emulators={emulators} onClose={() => setIsEditing(false)} onSave={handleSaveGame} />}
    </div>
  );
}
