import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Delete, Check, X } from 'lucide-react';
import './VirtualKeyboard.css';

const MAIN_LAYOUT = [
  [
    { low: '`', up: '~' }, { low: '1', up: '!' }, { low: '2', up: '@' }, { low: '3', up: '#' },
    { low: '4', up: '$' }, { low: '5', up: '%' }, { low: '6', up: '^' }, { low: '7', up: '&' },
    { low: '8', up: '*' }, { low: '9', up: '(' }, { low: '0', up: ')' }, { low: '-', up: '_' }, { low: '=', up: '+' }
  ],
  [
    { low: 'q', up: 'Q' }, { low: 'w', up: 'W' }, { low: 'e', up: 'E' }, { low: 'r', up: 'R' },
    { low: 't', up: 'T' }, { low: 'y', up: 'Y' }, { low: 'u', up: 'U' }, { low: 'i', up: 'I' },
    { low: 'o', up: 'O' }, { low: 'p', up: 'P' }, { low: '[', up: '{' }, { low: ']', up: '}' }
  ],
  [
    { low: 'a', up: 'A' }, { low: 's', up: 'S' }, { low: 'd', up: 'D' }, { low: 'f', up: 'F' },
    { low: 'g', up: 'G' }, { low: 'h', up: 'H' }, { low: 'j', up: 'J' }, { low: 'k', up: 'K' },
    { low: 'l', up: 'L' }, { low: ';', up: ':' }, { low: "'", up: '"' }, { low: '\\', up: '|' }
  ],
  [
    { low: 'z', up: 'Z' }, { low: 'x', up: 'X' }, { low: 'c', up: 'C' }, { low: 'v', up: 'V' },
    { low: 'b', up: 'B' }, { low: 'n', up: 'N' }, { low: 'm', up: 'M' }, { low: ',', up: '<' },
    { low: '.', up: '>' }, { low: '/', up: '?' }
  ]
];

const NUMPAD_LAYOUT = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['0', '.', '-']
];

export default function VirtualKeyboard({ value, onChange, onClose, isOpen }) {
  const containerRef = useRef(null);
  const [isShift, setIsShift] = useState(false);
  const [isCaps, setIsCaps] = useState(false);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      // Focus first key ONLY if focus is not already inside the container
      if (!containerRef.current.contains(document.activeElement)) {
        const firstKey = containerRef.current.querySelector('.vk-main-block button');
        if (firstKey) firstKey.focus();
      }
    }
  }, [isOpen]); // Only run when isOpen changes

  useEffect(() => {
    const handleEsc = (e) => {
      if (isOpen && (e.key === 'Escape' || e.key === 'Backspace')) {
        onClose();
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleEsc, { capture: true });
    }
    return () => window.removeEventListener('keydown', handleEsc, { capture: true });
  }, [isOpen, onClose]);

  // Reset shift and caps on close
  useEffect(() => {
    if (!isOpen) {
      setIsShift(false);
      setIsCaps(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isUpper = isShift || isCaps;

  const handleKey = (low, up) => {
    const char = isUpper ? up : low;
    onChange(value + char);
    if (isShift) setIsShift(false);
  };

  const handleBackspace = () => onChange(value.slice(0, -1));
  const handleClear = () => onChange('');
  const handleSpace = () => { onChange(value + ' '); if(isShift) setIsShift(false); };
  
  const toggleShift = () => setIsShift(!isShift);
  const toggleCaps = () => setIsCaps(!isCaps);

  return createPortal(
    <div className="vk-overlay" onClick={onClose}>
      <div className="vk-modal" onClick={e => e.stopPropagation()} ref={containerRef}>
        <div className="vk-header">
          <div className="vk-display">{value || <span className="vk-placeholder">Search...</span>}</div>
          <button className="vk-btn vk-action danger" onClick={handleClear}><X size={18}/> Clear</button>
          <button className="vk-btn vk-action success" onClick={onClose}><Check size={18} /> Done</button>
        </div>
        
        <div className="vk-layout-wrapper">
          <div className="vk-main-block">
            {MAIN_LAYOUT.map((row, rIdx) => (
              <div key={rIdx} className="vk-row">
                {rIdx === 2 && (
                  <button className={`vk-btn vk-special ${isCaps ? 'active' : ''}`} onClick={toggleCaps}>
                    Caps
                  </button>
                )}
                {rIdx === 3 && (
                  <button className={`vk-btn vk-special ${isShift ? 'active' : ''}`} onClick={toggleShift}>
                    Shift
                  </button>
                )}
                
                {row.map((k, i) => (
                  <button key={i} className="vk-btn" onClick={() => handleKey(k.low, k.up)}>
                    {isUpper ? k.up : k.low}
                  </button>
                ))}
                
                {rIdx === 0 && (
                  <button className="vk-btn vk-special vk-backspace" onClick={handleBackspace}>
                    <Delete size={18} />
                  </button>
                )}
                {rIdx === 3 && (
                   <button className={`vk-btn vk-special ${isShift ? 'active' : ''}`} onClick={toggleShift}>
                     Shift
                   </button>
                )}
              </div>
            ))}
            <div className="vk-row vk-bottom-row">
              <button className="vk-btn vk-space" onClick={handleSpace}>SPACE</button>
            </div>
          </div>

          <div className="vk-numpad-block">
            {NUMPAD_LAYOUT.map((row, rIdx) => (
              <div key={rIdx} className="vk-row">
                {row.map(char => (
                  <button key={char} className="vk-btn" onClick={() => handleKey(char, char)}>
                    {char}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
