import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './theme/ThemeContext';
import { GamepadProvider } from './context/GamepadContext';
import TopBar from './components/TopBar/TopBar';
import GamesPage from './pages/Games/GamesPage';
import EmulatorsPage from './pages/Emulators/EmulatorsPage';
import SettingsPage from './pages/Settings/SettingsPage';
import ControllerHints from './components/ControllerHints/ControllerHints';

function AppShell() {
  const [activeTab, setActiveTab] = useState('games');

  // Shared Library State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [favoritesFirst, setFavoritesFirst] = useState(false);
  const [groupPlatforms, setGroupPlatforms] = useState(true);
  const [hideNoArt, setHideNoArt] = useState(false);
  const [tileSize, setTileSize] = useState('md');

  // Global keyboard navigation: Tab switching and controller foundation
  useEffect(() => {
    function handleGlobalKeys(e) {
      // F5 / Ctrl+R: prevent reload in production feel
      // LB/RB simulation via PageUp/PageDown
      const tabs = ['games', 'emulators', 'settings'];
      const idx = tabs.indexOf(activeTab);

      if (e.key === 'PageDown' || (e.key === 'ArrowRight' && e.altKey)) {
        // RB → next tab
        e.preventDefault();
        setActiveTab(tabs[(idx + 1) % tabs.length]);
      } else if (e.key === 'PageUp' || (e.key === 'ArrowLeft' && e.altKey)) {
        // LB → prev tab
        e.preventDefault();
        setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length]);
      }
    }
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [activeTab]);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    setSearchQuery(''); // clear search when switching tabs
  }, []);

  let PageComponent;
  switch (activeTab) {
    case 'emulators':
      PageComponent = <EmulatorsPage searchQuery={searchQuery} />;
      break;
    case 'settings':
      PageComponent = <SettingsPage />;
      break;
    case 'games':
    default:
      PageComponent = <GamesPage 
        searchQuery={searchQuery}
        sortBy={sortBy}
        favoritesFirst={favoritesFirst}
        groupPlatforms={groupPlatforms}
        hideNoArt={hideNoArt}
        tileSize={tileSize}
      />;
      break;
  }

  return (
    <div className="app-shell">
      <TopBar 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        favoritesFirst={favoritesFirst}
        setFavoritesFirst={setFavoritesFirst}
        groupPlatforms={groupPlatforms}
        setGroupPlatforms={setGroupPlatforms}
        hideNoArt={hideNoArt}
        setHideNoArt={setHideNoArt}
        tileSize={tileSize}
        setTileSize={setTileSize}
      />
      <main className="app-content hide-scrollbar">
        {PageComponent}
      </main>
      <ControllerHints />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <GamepadProvider>
        <AppShell />
      </GamepadProvider>
    </ThemeProvider>
  );
}
