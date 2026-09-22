import { useEffect, useRef, useCallback } from 'react';

const AXIS_THRESHOLD = 0.5;
const REPEAT_DELAY = 300; // ms before first repeat
const REPEAT_RATE = 100;  // ms between repeats

export function useGamepad() {
  const requestRef = useRef();
  const stateRef = useRef({
    buttons: {},
    axes: {},
    lastTrigger: {}
  });

  const moveFocus = useCallback((direction) => {
    const focusable = Array.from(document.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.disabled && el.offsetParent !== null && window.getComputedStyle(el).visibility !== 'hidden');
    
    if (focusable.length === 0) return;
    
    const active = document.activeElement;
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
      let primaryDist = 0;
      let secDist = 0;

      if (direction === 'UP' && ty < cy - 5) { valid = true; primaryDist = cy - ty; secDist = Math.abs(cx - tx); }
      if (direction === 'DOWN' && ty > cy + 5) { valid = true; primaryDist = ty - cy; secDist = Math.abs(cx - tx); }
      if (direction === 'LEFT' && tx < cx - 5) { valid = true; primaryDist = cx - tx; secDist = Math.abs(cy - ty); }
      if (direction === 'RIGHT' && tx > cx + 5) { valid = true; primaryDist = tx - cx; secDist = Math.abs(cy - ty); }

      if (valid) {
        // Weight the secondary axis so we prefer elements directly in line
        const score = primaryDist + (secDist * 3);
        if (score < minDistance) {
          minDistance = score;
          bestMatch = el;
        }
      }
    });

    if (bestMatch) {
      bestMatch.focus();
      if (typeof bestMatch.scrollIntoViewIfNeeded === 'function') {
        bestMatch.scrollIntoViewIfNeeded();
      } else {
        bestMatch.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }, []);

  const dispatchKey = useCallback((key) => {
    const activeEl = document.activeElement;
    if (activeEl) {
      activeEl.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
    }
  }, []);

  const handleInput = useCallback((id, isPressed) => {
    const now = performance.now();
    const last = stateRef.current.lastTrigger[id] || 0;
    const isInitial = !stateRef.current.buttons[id];

    if (isPressed) {
      if (isInitial || now - last > (isInitial ? 0 : (stateRef.current.buttons[id] ? REPEAT_RATE : REPEAT_DELAY))) {
        if (isInitial) stateRef.current.lastTrigger[id] = now + REPEAT_DELAY - REPEAT_RATE;
        else stateRef.current.lastTrigger[id] = now;
        
        stateRef.current.buttons[id] = true;

        if (['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(id)) {
          moveFocus(id);
        } else {
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
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (!gamepads) return;

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp || !gp.connected) continue;

      // D-Pad and Axes
      const axes = gp.axes;
      handleInput('UP', gp.buttons[12]?.pressed || axes[1] < -AXIS_THRESHOLD);
      handleInput('DOWN', gp.buttons[13]?.pressed || axes[1] > AXIS_THRESHOLD);
      handleInput('LEFT', gp.buttons[14]?.pressed || axes[0] < -AXIS_THRESHOLD);
      handleInput('RIGHT', gp.buttons[15]?.pressed || axes[0] > AXIS_THRESHOLD);

      // Buttons
      handleInput('A', gp.buttons[0]?.pressed);
      handleInput('B', gp.buttons[1]?.pressed);
      handleInput('LB', gp.buttons[4]?.pressed);
      handleInput('RB', gp.buttons[5]?.pressed);

      // Scrolling (LT / RT mapped to scrolling active container)
      const lt = gp.buttons[6]?.value || 0;
      const rt = gp.buttons[7]?.value || 0;
      if (lt > 0.1 || rt > 0.1) {
        const scrollable = document.querySelector('.app-content') || document.documentElement;
        scrollable.scrollBy({ top: (rt - lt) * 20, behavior: 'auto' });
      }
      
      // Just handle the first active gamepad
      break; 
    }

    requestRef.current = requestAnimationFrame(updateLoop);
  }, [handleInput]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [updateLoop]);
}
