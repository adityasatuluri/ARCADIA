import React from 'react';
import { useGamepadConfig } from '../../context/GamepadContext';
import './ControllerHints.css';

export default function ControllerHints() {
  const { inputMode, getPromptLabel } = useGamepadConfig();
  const isGamepad = inputMode === 'gamepad';

  return (
    <div className={`controller-hints-container ${isGamepad ? 'visible' : ''}`}>
      <div className="controller-hints-bar">
        <div className="hint-item">
          <span className="hint-key">{getPromptLabel('A')}</span>
          <span className="hint-label">Select</span>
        </div>
        <div className="hint-item">
          <span className="hint-key">{getPromptLabel('B')}</span>
          <span className="hint-label">Back</span>
        </div>
        <div className="hint-item">
          <span className="hint-key">{getPromptLabel('LB')} / {getPromptLabel('RB')}</span>
          <span className="hint-label">Switch Tab</span>
        </div>
        <div className="hint-item">
          <span className="hint-key">{getPromptLabel('LT')} / {getPromptLabel('RT')}</span>
          <span className="hint-label">Scroll</span>
        </div>
        <div className="hint-item">
          <span className="hint-key">{getPromptLabel('SELECT')}</span>
          <span className="hint-label">Search</span>
        </div>
        <div className="hint-item">
          <span className="hint-key">{getPromptLabel('START')}</span>
          <span className="hint-label">View</span>
        </div>
      </div>
    </div>
  );
}
