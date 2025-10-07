import { useEffect } from 'react';

export interface KeyboardShortcuts {
  onNextVideo: () => void;
  onPrevVideo: () => void;
  onToggleMute: () => void;
  onToggleCaptions: () => void;
  onTogglePlayPause?: () => void;
  onFocusComment?: () => void;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        // Allow "/" to focus comment even when in input
        if (e.key === '/' && shortcuts.onFocusComment) {
          e.preventDefault();
          shortcuts.onFocusComment();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'j':
        case 'arrowdown':
          e.preventDefault();
          shortcuts.onNextVideo();
          break;
        case 'k':
        case 'arrowup':
          e.preventDefault();
          shortcuts.onPrevVideo();
          break;
        case 'm':
          e.preventDefault();
          shortcuts.onToggleMute();
          break;
        case 'c':
          e.preventDefault();
          shortcuts.onToggleCaptions();
          break;
        case ' ':
          e.preventDefault();
          shortcuts.onTogglePlayPause?.();
          break;
        case '/':
          e.preventDefault();
          shortcuts.onFocusComment?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

