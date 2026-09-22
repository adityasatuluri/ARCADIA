import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import GameEditor from '../../components/GameEditor/GameEditor';
import { useToast } from '../../components/Toast/ToastProvider';
import { Gamepad2, Star, StarOff, Pencil, Trash2, Plus } from 'lucide-react';
import './GamesPage.css';
import defaultBg from '../../assets/background.png';
import libraryTileImg from '../../assets/game_library_tile.jpg';

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
  const [selectedGameDetails, setSelectedGameDetails] = useState(null);

  const [showFullLibrary, setShowFullLibrary] = useState(false);

  useEffect(() => {
    const handleBack = (e) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (selectedGameDetails) {
          setSelectedGameDetails(null);
          e.preventDefault();
        } else if (showFullLibrary) {
          setShowFullLibrary(false);
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  }, [showFullLibrary, selectedGameDetails]);

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

  const handleToggleFav = async (game = focusedGame) => {
    if (!game || !window.arcadiaAPI) return;
    const res = await window.arcadiaAPI.games.toggleFavorite(game.id);
    if (res.success) {
      if (selectedGameDetails && selectedGameDetails.id === game.id) {
        setSelectedGameDetails({...selectedGameDetails, favorite: !selectedGameDetails.favorite});
      }
      loadData();
    }
  };

  const handleRemove = async (game = focusedGame) => {
    if (!game || !window.arcadiaAPI) return;
    if (!confirm(`Remove "${game.display_name}" from library?\n\nThis only removes it from Arcadia.`)) return;
    await window.arcadiaAPI.games.remove(game.id);
    addToast('Game Removed', `"${game.display_name}" has been removed.`, 'info');
    if (focusedGame?.id === game.id) setFocusedGame(null);
    if (selectedGameDetails?.id === game.id) setSelectedGameDetails(null);
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
            <div className="game-tile-placeholder"><Gamepad2 size={48} opacity={0.4} /></div>
          )}
          {game.favorite && <span className="game-tile-fav"><Star fill="#fff" color="#fff" size={18} /></span>}
          <span className="game-tile-platform">{game.platform}</span>
        </div>
        
        {isFocused && (
          <div className="tile-action-column">
            <button className="tile-action-btn" onClick={(e) => { e.stopPropagation(); handleToggleFav(); }}>
              {game.favorite ? <><StarOff size={14} /> Unfav</> : <><Star size={14} /> Fav</>}
            </button>
            <button className="tile-action-btn" onClick={(e) => { e.stopPropagation(); setEditingGame(game); setIsEditing(true); }}>
              <Pencil size={14} /> Edit
            </button>
            <button className="tile-action-btn danger" onClick={(e) => { e.stopPropagation(); handleRemove(); }}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
        )}
      </div>
    );
  };

  // ----- Filtering & Sorting Engine -----
  const deferredSearchQuery = React.useDeferredValue(searchQuery);

  const processedLibrary = useMemo(() => {
    let filtered = games;
    
    // 1. Hide No Art
    if (hideNoArt) filtered = filtered.filter(g => g.icon_path);

    // 2. Search Metadata Index
    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
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
  }, [games, deferredSearchQuery, hideNoArt, favoritesFirst, sortBy]);

  // Home Screen computation (Max 10 games)
  const homeGames = useMemo(() => {
    return processedLibrary.slice(0, 10);
  }, [processedLibrary]);

  // Grouping (For Full Library View only)
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
          <div className="games-empty-icon"><Gamepad2 size={64} opacity={0.5} /></div>
          <div className="games-empty-title">Your library is empty</div>
          <div className="games-empty-sub">Go to Settings to add Library Locations and scan your folders.</div>
        </div>
      </div>
    );
  }

  const displayGame = selectedGameDetails || (showFullLibrary ? null : focusedGame);
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

      <div className={`library-content-area ${showFullLibrary ? 'full-library' : ''}`}>
        {selectedGameDetails ? (
          <div className="game-details-view">
            <button className="btn-secondary" style={{alignSelf: 'flex-start', marginBottom: '24px'}} onClick={() => setSelectedGameDetails(null)}>Esc / Back</button>
            <div className="game-details-content">
              <h1 className="game-details-title" style={{fontSize: '48px', fontWeight: '800', marginBottom: '16px'}}>{selectedGameDetails.display_name}</h1>
              <div className="game-details-meta" style={{display: 'flex', gap: '16px', color: 'rgba(255,255,255,0.7)', fontSize: '16px', marginBottom: '32px'}}>
                {selectedGameDetails.developer && <span>{selectedGameDetails.developer}</span>}
                {selectedGameDetails.year && <span> • {selectedGameDetails.year}</span>}
                {selectedGameDetails.platform && <span> • {selectedGameDetails.platform}</span>}
              </div>
              
              <div className="game-details-actions" style={{display: 'flex', gap: '12px', marginBottom: '40px'}}>
                <button className="btn-primary" autoFocus onClick={() => handleTileClick(selectedGameDetails)} style={{fontSize: '18px', padding: '12px 32px'}}>Play</button>
                <button className="btn-secondary" onClick={() => { setEditingGame(selectedGameDetails); setIsEditing(true); }}>Edit Configuration</button>
                <button className="btn-secondary" onClick={() => handleToggleFav(selectedGameDetails)}>
                  {selectedGameDetails.favorite ? 'Unfavorite' : 'Favorite'}
                </button>
                <button className="btn-secondary danger" onClick={() => handleRemove(selectedGameDetails)}>Remove</button>
              </div>
              
              <p className="game-details-desc" style={{fontSize: '16px', lineHeight: '1.6', color: 'rgba(255,255,255,0.8)', maxWidth: '800px'}}>{selectedGameDetails.description || 'No description available.'}</p>
            </div>
          </div>
        ) : (
        <div className="library-grids">
          
          {!showFullLibrary ? (
            /* --- HOME SCREEN VIEW --- */
            <div className="library-group">
              <div 
                className="tile-grid-horizontal"
                style={{ 
                  transform: `translateX(${trackAnchorId ? `calc(64px - ${
                    (homeGames.findIndex(g => g.id === trackAnchorId) !== -1 
                      ? (homeGames.findIndex(g => g.id === trackAnchorId) + 1)
                      : (focusedGame === 'library' ? homeGames.length + 1 : 0)
                    ) * 132}px)` : '64px'})`, 
                  transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)' 
                }}
              >
                {/* Add Game Tile */}
                <button 
                  autoFocus 
                  className={`game-tile tile-add ${(!focusedGame || focusedGame === 'add') ? 'focused size-md' : 'size-sm'}`} 
                  tabIndex={0} 
                  onClick={() => {setEditingGame(null); setIsEditing(true);}} 
                  onFocus={(e) => { setFocusedGame('add'); setTrackAnchorId(null); }}
                  onMouseEnter={() => { setFocusedGame('add'); setTrackAnchorId(null); }}
                >
                  <span className="tile-add-icon"><Plus size={40} /></span>
                  {(!focusedGame || focusedGame === 'add') && <span>Add Game</span>}
                </button>

                {/* 10 Home Games */}
                {homeGames.map(renderTile)}

                {/* Game Library Tile */}
                <button 
                  className={`game-tile tile-library ${focusedGame === 'library' ? 'focused size-md' : 'size-sm'}`} 
                  tabIndex={0} 
                  onClick={() => setShowFullLibrary(true)} 
                  onFocus={() => { setFocusedGame('library'); setTrackAnchorId('library'); }}
                  onMouseEnter={() => { setFocusedGame('library'); setTrackAnchorId('library'); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setShowFullLibrary(true);
                    }
                  }}
                >
                  <div className="game-tile-cover-wrap library-cover">
                    <img src={libraryTileImg} alt="Game Library" draggable={false} loading="lazy" className="library-tile-icon" />
                  </div>
                </button>
              </div>
            </div>
          ) : (
            /* --- FULL LIBRARY VIEW --- */
            <div className="full-library-view">
              <div className="full-library-header">
                <h2>Game Library</h2>
                <button className="btn-secondary" onClick={() => setShowFullLibrary(false)}>Esc / Back</button>
              </div>
              
              {Object.entries(libraryGroups).map(([groupName, groupGames]) => {
                if (groupGames.length === 0) return null;
                return (
                  <div key={groupName} className="library-group">
                    {groupPlatforms && <h2 className="section-label">{groupName}</h2>}
                    <div className="tile-grid">
                      {groupGames.map((game) => {
                        const isFocused = focusedGame && focusedGame.id === game.id;
                        const iconSrc = game.icon_path ? `file://${game.icon_path.replace(/\\/g, '/')}` : null;
                        return (
                          <div
                            key={game.id}
                            className="game-tile size-sm" /* Fixed size for grid */
                            tabIndex={0}
                            onClick={() => setSelectedGameDetails(game)}
                            onKeyDown={(e) => {
                              if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { 
                                e.preventDefault(); setSelectedGameDetails(game); 
                              }
                            }}
                          >
                            <div className="game-tile-cover-wrap">
                              {iconSrc ? (
                                <img src={iconSrc} alt={game.display_name} draggable={false} loading="lazy" />
                              ) : (
                                <div className="game-tile-placeholder"><Gamepad2 size={48} opacity={0.4} /></div>
                              )}
                              {game.favorite && <span className="game-tile-fav"><Star fill="#fff" color="#fff" size={18} /></span>}
                              <span className="game-tile-platform">{game.platform}</span>
                            </div>
                            <div className="grid-tile-title">{game.display_name}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
      </div>
      
      {/* Lower Details Area */}
      {!showFullLibrary && !selectedGameDetails && (
        <>
          {displayGame && typeof displayGame === 'object' && (
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
          {(!displayGame || focusedGame === 'add') && focusedGame !== 'library' && (
            <div className="focused-game-footer">
              <h2 className="focused-game-title">Add a Game</h2>
              <p className="focused-game-desc">Manually configure a new PC game or emulator game.</p>
            </div>
          )}
          {focusedGame === 'library' && (
            <div className="focused-game-footer">
              <h2 className="focused-game-title">Game Library</h2>
              <p className="focused-game-desc">View and manage your complete collection of games.</p>
            </div>
          )}
        </>
      )}

      {isEditing && <GameEditor game={editingGame} emulators={emulators} onClose={() => setIsEditing(false)} onSave={handleSaveGame} />}
    </div>
  );
}
