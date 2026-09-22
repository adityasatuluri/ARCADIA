import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const GamepadContext = createContext();

export function useGamepadConfig() {
  return useContext(GamepadContext);
}

export function GamepadProvider({ children }) {
  const [gamepads, setGamepads] = useState([]);
  const [activeGamepadId, setActiveGamepadId] = useState(null);
  
  // Settings
  const [analogSensitivity, setAnalogSensitivity] = useState(0.5);
  const [triggerSensitivity, setTriggerSensitivity] = useState(0.1);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [promptStyle, setPromptStyle] = useState('xbox'); // xbox, ps, generic

  const stateRef = useRef({ buttons: {}, axes: {}, lastTrigger: {} });
  const requestRef = useRef();

  // State for Input Mode
  const inputModeRef = useRef('mouse');
  const [inputMode, setInputModeState] = useState('mouse');

  const setInputMode = useCallback((mode) => {
    if (inputModeRef.current !== mode) {
      inputModeRef.current = mode;
      setInputModeState(mode);
    }
  }, []);

  // Listen to keyboard/mouse to switch mode
  useEffect(() => {
    const handleMouseOrKey = (e) => {
      if (e.type === 'keydown' && !e.isTrusted) return; // ignore our synthesized gamepads
      if (e.type === 'mousemove' && Math.abs(e.movementX) < 2 && Math.abs(e.movementY) < 2) return; // ignore jitter
      setInputMode('mouse');
    };
    window.addEventListener('mousemove', handleMouseOrKey);
    window.addEventListener('mousedown', handleMouseOrKey);
    window.addEventListener('keydown', handleMouseOrKey);
    return () => {
      window.removeEventListener('mousemove', handleMouseOrKey);
      window.removeEventListener('mousedown', handleMouseOrKey);
      window.removeEventListener('keydown', handleMouseOrKey);
    };
  }, [setInputMode]);

  const PROMPT_DICT = {
    xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', UP: 'D-Pad Up' },
    ps: { A: '✕', B: '◯', X: '◻', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', UP: 'D-Pad Up' },
    generic: { A: 'Confirm', B: 'Cancel', X: 'Action 1', Y: 'Action 2', LB: 'Prev', RB: 'Next', LT: 'Scroll Up', RT: 'Scroll Down', UP: 'Up' }
  };

  const getPromptLabel = useCallback((logicalKey) => {
    return PROMPT_DICT[promptStyle]?.[logicalKey] || logicalKey;
  }, [promptStyle]);

  // Load/Save settings (we would normally use arcadiaAPI.settings here)
  useEffect(() => {
    if (window.arcadiaAPI) {
      window.arcadiaAPI.settings.get('gamepad_config').then(res => {
        if (res.success && res.data) {
          setAnalogSensitivity(res.data.analogSensitivity || 0.5);
          setTriggerSensitivity(res.data.triggerSensitivity || 0.1);
          setVibrationEnabled(res.data.vibrationEnabled ?? true);
          setPromptStyle(res.data.promptStyle || 'xbox');
        }
      });
    }
  }, []);

  const saveConfig = (newConfig) => {
    if (window.arcadiaAPI) {
      window.arcadiaAPI.settings.set('gamepad_config', newConfig);
    }
  };

  const updateConfig = (key, value) => {
    const newConfig = { analogSensitivity, triggerSensitivity, vibrationEnabled, promptStyle, [key]: value };
    if (key === 'analogSensitivity') setAnalogSensitivity(value);
    if (key === 'triggerSensitivity') setTriggerSensitivity(value);
    if (key === 'vibrationEnabled') setVibrationEnabled(value);
    if (key === 'promptStyle') setPromptStyle(value);
    saveConfig(newConfig);
  };

  const vibrate = useCallback((duration = 100, weak = 0.5, strong = 0.5) => {
    if (!vibrationEnabled) return;
    const gpArray = Array.from(navigator.getGamepads ? navigator.getGamepads() : []);
    const target = gpArray.find(g => g && g.id === activeGamepadId) || gpArray.find(g => g && g.connected);
    if (target && target.vibrationActuator) {
      target.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: duration,
        weakMagnitude: weak,
        strongMagnitude: strong
      }).catch(() => {});
    }
  }, [vibrationEnabled, activeGamepadId]);

  // Handle Gamepad Connections
  useEffect(() => {
    const handleConnect = (e) => {
      console.log('Gamepad connected:', e.gamepad);
      const gpArray = Array.from(navigator.getGamepads ? navigator.getGamepads() : []);
      setGamepads(gpArray.filter(g => g && g.connected));
      if (!activeGamepadId) setActiveGamepadId(e.gamepad.id);
      vibrate(200, 0.5, 0.5);
    };
    const handleDisconnect = (e) => {
      console.log('Gamepad disconnected:', e.gamepad);
      const gpArray = Array.from(navigator.getGamepads ? navigator.getGamepads() : []);
      setGamepads(gpArray.filter(g => g && g.connected));
      if (activeGamepadId === e.gamepad.id) setActiveGamepadId(null);
    };

    window.addEventListener('gamepadconnected', handleConnect);
    window.addEventListener('gamepaddisconnected', handleDisconnect);
    return () => {
      window.removeEventListener('gamepadconnected', handleConnect);
      window.removeEventListener('gamepaddisconnected', handleDisconnect);
    };
  }, [activeGamepadId, vibrate]);

  // 2D Spatial Navigation with Modal Focus Trapping
  const moveFocus = useCallback((direction) => {
    // 1. Detect if a modal is open to trap focus inside it (Section 31: Modal Focus)
    const activeModal = document.querySelector('.game-editor-overlay, .modal-overlay');
    const searchRoot = activeModal || document;

    const focusable = Array.from(searchRoot.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.disabled && el.offsetParent !== null && window.getComputedStyle(el).visibility !== 'hidden');
    
    if (focusable.length === 0) return;
    const active = document.activeElement;
    
    // 2. If focus is lost or outside the modal, force it into the modal
    if (!active || !focusable.includes(active)) {
      focusable[0].focus();
      return;
    }

    const rect = active.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let bestMatch = null;
    let minDistance = Infinity;

    focusable.forEach(el => {
      if (el === active) return;
      const r = el.getBoundingClientRect();
      const tx = r.left + r.width / 2;
      const ty = r.top + r.height / 2;
      let valid = false;
      let primaryDist = 0, secDist = 0;

      if (direction === 'UP' && ty < cy - 5) { valid = true; primaryDist = cy - ty; secDist = Math.abs(cx - tx); }
      if (direction === 'DOWN' && ty > cy + 5) { valid = true; primaryDist = ty - cy; secDist = Math.abs(cx - tx); }
      if (direction === 'LEFT' && tx < cx - 5) { valid = true; primaryDist = cx - tx; secDist = Math.abs(cy - ty); }
      if (direction === 'RIGHT' && tx > cx + 5) { valid = true; primaryDist = tx - cx; secDist = Math.abs(cy - ty); }

      if (valid) {
        const score = primaryDist + (secDist * 3);
        if (score < minDistance) { minDistance = score; bestMatch = el; }
      }
    });

    if (bestMatch) {
      bestMatch.focus();
      if (typeof bestMatch.scrollIntoViewIfNeeded === 'function') bestMatch.scrollIntoViewIfNeeded();
      else bestMatch.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      // Small tick vibration on navigate
      vibrate(10, 0.1, 0.0);
    }
  }, [vibrate]);

  const dispatchKey = useCallback((key) => {
    const activeEl = document.activeElement;
    if (activeEl) {
      // Untrusted keyboard events do not trigger native clicks for buttons/divs.
      if (key === 'Enter' && typeof activeEl.click === 'function') {
        activeEl.click();
      } else {
        activeEl.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
      }
      
      // Small click vibration on interaction
      vibrate(20, 0.2, 0.2);
    }
  }, [vibrate]);

  const handleInput = useCallback((id, isPressed) => {
    const now = performance.now();
    const last = stateRef.current.lastTrigger[id] || 0;
    const isInitial = !stateRef.current.buttons[id];
    const REPEAT_DELAY = 300;
    const REPEAT_RATE = 100;

    if (isPressed) {
      if (isInitial || now - last > (isInitial ? 0 : (stateRef.current.buttons[id] ? REPEAT_RATE : REPEAT_DELAY))) {
        stateRef.current.lastTrigger[id] = isInitial ? (now + REPEAT_DELAY - REPEAT_RATE) : now;
        stateRef.current.buttons[id] = true;

        if (['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(id)) moveFocus(id);
        else {
          switch(id) {
            case 'A': dispatchKey('Enter'); break;
            case 'B': dispatchKey('Escape'); break;
            case 'LB': dispatchKey('PageUp'); break;
            case 'RB': dispatchKey('PageDown'); break;
          }
        }
      }
    } else {
      stateRef.current.buttons[id] = false;
      stateRef.current.lastTrigger[id] = 0;
    }
  }, [moveFocus, dispatchKey]);

  const updateLoop = useCallback(() => {
    const gpArray = Array.from(navigator.getGamepads ? navigator.getGamepads() : []);
    // Just use the active gamepad, or the first connected
    const gp = gpArray.find(g => g && g.id === activeGamepadId) || gpArray.find(g => g && g.connected);

    if (gp) {
      // D-Pad and Axes
      const axes = gp.axes;
      handleInput('UP', gp.buttons[12]?.pressed || (axes && axes[1] < -analogSensitivity));
      handleInput('DOWN', gp.buttons[13]?.pressed || (axes && axes[1] > analogSensitivity));
      handleInput('LEFT', gp.buttons[14]?.pressed || (axes && axes[0] < -analogSensitivity));
      handleInput('RIGHT', gp.buttons[15]?.pressed || (axes && axes[0] > analogSensitivity));

      // Buttons
      handleInput('A', gp.buttons[0]?.pressed);
      handleInput('B', gp.buttons[1]?.pressed);
      handleInput('LB', gp.buttons[4]?.pressed);
      handleInput('RB', gp.buttons[5]?.pressed);

      // Triggers
      const lt = gp.buttons[6]?.value || 0;
      const rt = gp.buttons[7]?.value || 0;
      if (lt > triggerSensitivity || rt > triggerSensitivity) {
        const scrollable = document.querySelector('.app-content') || document.documentElement;
        scrollable.scrollBy({ top: (rt - lt) * 20, behavior: 'auto' });
      }

      // Input Mode Detection
      const hasAxis = axes && axes.some(a => Math.abs(a) > analogSensitivity);
      const hasButton = gp.buttons.some(b => b.pressed);
      if (hasAxis || hasButton) {
        setInputMode('gamepad');
      }
    }

    requestRef.current = requestAnimationFrame(updateLoop);
  }, [activeGamepadId, analogSensitivity, triggerSensitivity, handleInput, setInputMode]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [updateLoop]);

  return (
    <GamepadContext.Provider value={{
      gamepads,
      activeGamepadId,
      setActiveGamepadId,
      analogSensitivity,
      triggerSensitivity,
      vibrationEnabled,
      promptStyle,
      updateConfig,
      vibrate,
      inputMode,
      getPromptLabel
    }}>
      {children}
    </GamepadContext.Provider>
  );
}
