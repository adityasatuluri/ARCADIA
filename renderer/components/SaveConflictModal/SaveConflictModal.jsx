import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from '../../hooks/useModalFocus';
import './SaveConflictModal.css';

export default function SaveConflictModal({ title, onResolve }) {
  const modalRef = useRef(null);
  useModalFocus(modalRef);

  return createPortal(
    <div className="save-conflict-overlay">
      <div className="save-conflict-modal" ref={modalRef}>
        <h2>{title}</h2>
        <p>How would you like to handle existing save files in the destination?</p>
        
        <div className="save-conflict-actions">
          <button 
            className="btn-primary" 
            onClick={() => onResolve('backup_then_replace')} 
            tabIndex={0}
          >
            Backup Then Replace (Recommended)
          </button>
          <button 
            className="btn-secondary danger" 
            onClick={() => onResolve('replace')} 
            tabIndex={0}
          >
            Replace (Overwrite)
          </button>
          <button 
            className="btn-cancel" 
            onClick={() => onResolve('skip')} 
            tabIndex={0}
          >
            Skip Files
          </button>
          <button 
            className="btn-cancel" 
            onClick={() => onResolve('cancel')} 
            tabIndex={0}
          >
            Cancel Entire Operation
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
