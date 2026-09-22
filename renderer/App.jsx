import React, { useState, useEffect } from 'react';

function App() {
  const [status, setStatus] = useState('Checking database...');
  const [emulators, setEmulators] = useState([]);
  const [games, setGames] = useState([]);
  const [scanPath, setScanPath] = useState('Z:\\');
  const [scanStats, setScanStats] = useState(null);

  useEffect(() => {
    async function testDB() {
      if (!window.arcadiaAPI) {
        setStatus('arcadiaAPI not available.');
        return;
      }

      // Hook up scanner progress
      if (window.arcadiaAPI.scanner) {
        window.arcadiaAPI.scanner.onProgress((data) => setScanStats(data));
      }

      try {
        setStatus('Fetching initial data...');
        // Emulators test
        const emuRes = await window.arcadiaAPI.emulators.getAll();
        if (emuRes.success) setEmulators(emuRes.data);
        
        // Games test
        const gamesRes = await window.arcadiaAPI.games.getAll();
        if (gamesRes.success) setGames(gamesRes.data);

        setStatus(`Database ready.`);
      } catch (err) {
        setStatus(`Database Error: ${err.message}`);
      }
    }
    testDB();
  }, []);

  const runScan = async () => {
    if (!window.arcadiaAPI) return;
    setStatus(`Scanning ${scanPath}...`);
    const res = await window.arcadiaAPI.scanner.start(scanPath);
    if (res.success) {
      setStatus(`Scan complete.`);
      // Refresh
      const emuRes = await window.arcadiaAPI.emulators.getAll();
      if (emuRes.success) setEmulators(emuRes.data);
      const gamesRes = await window.arcadiaAPI.games.getAll();
      if (gamesRes.success) setGames(gamesRes.data);
    } else {
      setStatus(`Scan failed: ${res.error}`);
    }
  };

  return (
    <div style={{ padding: '40px' }}>
      <h1 style={{ fontSize: '2.5rem', letterSpacing: '2px', textAlign: 'center' }}>ARCADIA</h1>
      <p style={{ textAlign: 'center', color: '#888' }}>Scanner Service & Auto-Detection Integration</p>
      
      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
        <h3>Status: {status}</h3>
        {scanStats && (
          <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#00cc66' }}>
            <p><strong>Crawling:</strong> {scanStats.currentLocation}</p>
            <p><strong>Files:</strong> {scanStats.filesDiscovered} | <strong>Games:</strong> {scanStats.gamesDiscovered} | <strong>Emulators:</strong> {scanStats.emulatorsDiscovered}</p>
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '8px', display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          value={scanPath} 
          onChange={e => setScanPath(e.target.value)} 
          style={{ padding: '10px', flex: 1, backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '4px' }}
        />
        <button onClick={runScan} style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#0070cc', color: 'white', border: 'none', borderRadius: '4px' }}>
          Start Scan
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        <div style={{ flex: 1, padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
          <h3>Emulators ({emulators.length})</h3>
          <ul style={{ fontSize: '0.9rem', color: '#ccc' }}>
            {emulators.map(e => <li key={e.id}>{e.display_name} ({e.platform}) - {e.executable}</li>)}
          </ul>
        </div>
        
        <div style={{ flex: 1, padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
          <h3>Games ({games.length})</h3>
          <ul style={{ fontSize: '0.9rem', color: '#ccc' }}>
            {games.map(g => <li key={g.id}>{g.display_name} [{g.platform}] - {g.game_path}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
