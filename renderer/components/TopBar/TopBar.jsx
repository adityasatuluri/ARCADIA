import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import './TopBar.css';
import arcadiaLogo from '../../assets/arcadia_top_bar_logo.png';

const TABS = [
  { id: 'games', label: 'Games' },
  { id: 'emulators', label: 'Emulators' },
  { id: 'settings', label: 'Settings' }
];

export default function TopBar({ 
  activeTab, 
  onTabChange,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  favoritesFirst,
  setFavoritesFirst,
  groupPlatforms,
  setGroupPlatforms,
  hideNoArt,
  setHideNoArt,
  tileSize,
  setTileSize
}) {
  const { theme, toggleTheme } = useTheme();
  const [clock, setClock] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    function tick() {
      const now = new Date();
      setClock(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="topbar">
      {/* Brand */}
      <div className="topbar-brand" onClick={() => onTabChange('games')} style={{ cursor: 'pointer' }}>
        <img src={arcadiaLogo} alt="Arcadia" className="topbar-logo-img" />
      </div>

      {/* Navigation Tabs */}
      <nav className="topbar-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`topbar-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            tabIndex={0}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Right section */}
      <div className="topbar-right">
        {/* Search */}
        <div className="topbar-search">
          <svg className="topbar-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input 
            type="text" 
            placeholder={
              activeTab === 'emulators' ? 'Search emulators...' : 
              activeTab === 'settings' ? 'Search settings...' : 
              'Search games, platforms...'
            }
            value={searchQuery || ''}
            onChange={e => setSearchQuery && setSearchQuery(e.target.value)}
            tabIndex={0}
          />
        </div>

        {/* View Settings (Only in Games Tab) */}
        {activeTab === 'games' && (
          <div className="topbar-settings-dropdown" 
               onMouseEnter={() => setIsSettingsOpen(true)} 
               onMouseLeave={() => setIsSettingsOpen(false)}
               onFocus={() => setIsSettingsOpen(true)}
               onBlur={(e) => {
                 if (!e.currentTarget.contains(e.relatedTarget)) setIsSettingsOpen(false);
               }}>
            <button className="topbar-icon-btn view-btn" tabIndex={0} title="Library Settings" onClick={() => setIsSettingsOpen(!isSettingsOpen)}>
              ⚙️ View
            </button>
            
            {isSettingsOpen && (
              <div className="topbar-settings-menu">
                <div className="menu-group">
                  <label>Sort By</label>
                  <select value={sortBy} onChange={e => setSortBy && setSortBy(e.target.value)} tabIndex={0}>
                    <option value="name_asc">Sort A-Z</option>
                    <option value="recent_played">Recently Played</option>
                    <option value="recent_added">Recently Added</option>
                    <option value="platform">By Platform</option>
                  </select>
                </div>

                <div className="menu-group">
                  <label>Tile Size</label>
                  <select value={tileSize} onChange={e => setTileSize && setTileSize(e.target.value)} tabIndex={0}>
                    <option value="sm">Small Tiles</option>
                    <option value="md">Medium Tiles</option>
                    <option value="lg">Large Tiles</option>
                  </select>
                </div>

                <div className="menu-divider"></div>

                <label className="menu-toggle" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' && setFavoritesFirst) setFavoritesFirst(!favoritesFirst) }}>
                  <input type="checkbox" checked={favoritesFirst || false} onChange={e => setFavoritesFirst && setFavoritesFirst(e.target.checked)} tabIndex={-1} />
                  <span>Favorites First</span>
                </label>
                <label className="menu-toggle" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' && setGroupPlatforms) setGroupPlatforms(!groupPlatforms) }}>
                  <input type="checkbox" checked={groupPlatforms || false} onChange={e => setGroupPlatforms && setGroupPlatforms(e.target.checked)} tabIndex={-1} />
                  <span>Group Platforms</span>
                </label>
                <label className="menu-toggle" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' && setHideNoArt) setHideNoArt(!hideNoArt) }}>
                  <input type="checkbox" checked={hideNoArt || false} onChange={e => setHideNoArt && setHideNoArt(e.target.checked)} tabIndex={-1} />
                  <span>Hide Missing Art</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Clock */}
        <span className="topbar-clock">{clock}</span>
      </div>
    </header>
  );
}
