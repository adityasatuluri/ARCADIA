import { useEffect, useRef } from 'react';

export function useModalFocus(modalRef) {
  const previousFocusRef = useRef(null);

  useEffect(() => {
    // 1. Save previous focus
    previousFocusRef.current = document.activeElement;

    // 2. Focus first safe action inside the modal
    if (modalRef.current) {
      const focusable = Array.from(modalRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter(el => !el.disabled && el.offsetParent !== null && window.getComputedStyle(el).visibility !== 'hidden');
      
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }

    // 7. Restore previous focus after closing
    return () => {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        // Small delay to ensure the DOM has updated and the previous element is interactable again
        setTimeout(() => {
          previousFocusRef.current.focus();
        }, 10);
      }
    };
  }, [modalRef]);
}
