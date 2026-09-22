import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './theme/ThemeContext';
import TopBar from './components/TopBar/TopBar';
import GamesPage from './pages/Games/GamesPage';
import EmulatorsPage from './pages/Emulators/EmulatorsPage';
import SettingsPage from './pages/Settings/SettingsPage';

function AppShell() {
  const [activeTab, setActiveTab] = useState('games');

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
  }, []);

  let PageComponent;
  switch (activeTab) {
    case 'emulators':
      PageComponent = <EmulatorsPage />;
      break;
    case 'settings':
      PageComponent = <SettingsPage />;
      break;
    case 'games':
    default:
      PageComponent = <GamesPage />;
      break;
  }

  return (
    <div className="app-shell">
      <TopBar activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="app-content hide-scrollbar">
        {PageComponent}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
