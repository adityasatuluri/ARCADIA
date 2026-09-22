import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../theme/ThemeContext';
import './TopBar.css';

const TABS = [
  { id: 'games', label: 'Games' },
  { id: 'emulators', label: 'Emulators' },
  { id: 'settings', label: 'Settings' }
];

export default function TopBar({ activeTab, onTabChange }) {
  const { theme, toggleTheme } = useTheme();
  const [clock, setClock] = useState('');

  useEffect(() => {
    function tick() {
      const now = new Date();
      setClock(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  // Keyboard: LB/RB tab switching (we listen for left/right arrow on topbar focus)
  const handleKeyDown = useCallback((e) => {
    const currentIndex = TABS.findIndex(t => t.id === activeTab);
    if (e.key === 'ArrowRight' || e.key === 'Tab') {
      e.preventDefault();
      const next = (currentIndex + 1) % TABS.length;
      onTabChange(TABS[next].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (currentIndex - 1 + TABS.length) % TABS.length;
      onTabChange(TABS[prev].id);
    }
  }, [activeTab, onTabChange]);

  return (
    <header className="topbar">
      {/* Brand */}
      <div className="topbar-brand">
        <div className="topbar-logo">A</div>
        <span className="topbar-title">ARCADIA</span>
      </div>

      {/* Navigation Tabs */}
      <nav className="topbar-nav" onKeyDown={handleKeyDown}>
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
            placeholder={activeTab === 'emulators' ? 'Search emulators...' : 'Search games...'}
            tabIndex={0}
          />
        </div>



        {/* Settings gear */}
        <button 
          className="topbar-icon-btn"
          onClick={() => onTabChange('settings')}
          title="Settings"
          tabIndex={0}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>

        {/* Clock */}
        <span className="topbar-clock">{clock}</span>
      </div>
    </header>
  );
}
