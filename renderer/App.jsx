import React, { useState, useEffect } from 'react';

function App() {
  const [pingStatus, setPingStatus] = useState('Checking IPC...');

  useEffect(() => {
    async function testIpc() {
      if (window.arcadiaAPI && window.arcadiaAPI.system) {
        try {
          const response = await window.arcadiaAPI.system.ping();
          setPingStatus(`IPC successful: ${response}`);
        } catch (err) {
          setPingStatus(`IPC Error: ${err.message}`);
        }
      } else {
        setPingStatus('arcadiaAPI not found. Preload script may not be loaded.');
      }
    }
    
    testIpc();
  }, []);

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '3rem', letterSpacing: '4px' }}>ARCADIA</h1>
      <p style={{ fontSize: '1.2rem', color: '#aaaaaa' }}>PS5-Style Game Library & Emulator Frontend</p>
      
      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#1e1e1e', borderRadius: '8px', display: 'inline-block' }}>
        <h3>Foundation Test</h3>
        <p><strong>Status:</strong> {pingStatus}</p>
        <p><strong>Environment:</strong> {window.arcadiaAPI ? 'Electron' : 'Browser'}</p>
      </div>
    </div>
  );
}

export default App;
