/**
 * Keyboard Navigation and Focus Management
 * 
 * This utility provides keyboard navigation support and focus management
 * for better accessibility and user experience.
 */
import React from 'react';

/**
 * Trap focus within a container (for modals, dialogs, etc.)
 */
export const trapFocus = (container: HTMLElement) => {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  container.addEventListener('keydown', handleTabKey);

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleTabKey);
  };
};

/**
 * Set focus to the first focusable element in a container
 */
export const setInitialFocus = (container: HTMLElement) => {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0] as HTMLElement;
  if (firstElement) {
    firstElement.focus();
  }
};

/**
 * Handle keyboard navigation for a list/grid of items
 */
export const handleListNavigation = (
  e: KeyboardEvent,
  items: HTMLElement[],
  currentIndex: number,
  onSelect: (index: number) => void
): number => {
  let newIndex = currentIndex;

  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      e.preventDefault();
      newIndex = (currentIndex + 1) % items.length;
      break;
    case 'ArrowUp':
    case 'ArrowLeft':
      e.preventDefault();
      newIndex = (currentIndex - 1 + items.length) % items.length;
      break;
    case 'Home':
      e.preventDefault();
      newIndex = 0;
      break;
    case 'End':
      e.preventDefault();
      newIndex = items.length - 1;
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      onSelect(currentIndex);
      return currentIndex;
    default:
      return currentIndex;
  }

  items[newIndex]?.focus();
  return newIndex;
};

/**
 * Create a keyboard shortcut handler
 */
export const createKeyboardShortcut = (
  shortcuts: Record<string, () => void>,
  target: HTMLElement | Document = document
) => {
  const handleKeyDown = (e: Event) => {
    const keyboardEvent = e as KeyboardEvent;
    const key = keyboardEvent.key.toLowerCase();
    const modifiers = {
      ctrl: keyboardEvent.ctrlKey,
      alt: keyboardEvent.altKey,
      shift: keyboardEvent.shiftKey,
      meta: keyboardEvent.metaKey,
    };

    for (const [shortcut, handler] of Object.entries(shortcuts)) {
      const parts = shortcut.toLowerCase().split('+');
      const requiredKey = parts.pop();
      const requiredModifiers: (keyof typeof modifiers)[] = parts as any[];

      if (key === requiredKey) {
        const allModifiersMatch = requiredModifiers.every(
          (mod) => modifiers[mod]
        );

        if (allModifiersMatch) {
          e.preventDefault();
          handler();
          return;
        }
      }
    }
  };

  target.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    target.removeEventListener('keydown', handleKeyDown);
  };
};

/**
 * Manage focus restoration when navigating between pages
 */
export const saveFocus = (): (() => void) => {
  const activeElement = document.activeElement as HTMLElement;
  return () => {
    if (activeElement && document.contains(activeElement)) {
      activeElement.focus();
    }
  };
};

/**
 * Check if an element is focusable
 */
export const isFocusable = (element: HTMLElement): boolean => {
  if (element.tabIndex < 0) return false;
  if ((element as any).disabled) return false;
  if (element.hidden) return false;
  if (element.offsetParent === null) return false;

  const focusableTags = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'];
  if (focusableTags.includes(element.tagName)) return true;

  return element.tabIndex >= 0;
};

/**
 * Get all focusable elements within a container
 */
export const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const focusable = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(focusable).filter(isFocusable);
};

/**
 * Handle escape key for closing modals/menus
 */
export const handleEscape = (
  callback: () => void,
  target: HTMLElement | Document = document
) => {
  const handleKeyDown = (e: Event) => {
    const keyboardEvent = e as KeyboardEvent;
    if (keyboardEvent.key === 'Escape') {
      callback();
    }
  };

  target.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    target.removeEventListener('keydown', handleKeyDown);
  };
};

/**
 * Focus trap hook for React components
 */
export const useFocusTrap = (containerRef: React.RefObject<HTMLElement>) => {
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cleanup = trapFocus(container);
    setInitialFocus(container);

    return cleanup;
  }, [containerRef]);
};

/**
 * Keyboard navigation hook for lists
 */
export const useKeyboardNavigation = (
  items: React.RefObject<HTMLElement>[],
  onSelect: (index: number) => void
) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const handleKeyDown = (e: KeyboardEvent) => {
    const elements = items.map((ref) => ref.current).filter(Boolean) as HTMLElement[];
    setCurrentIndex(
      handleListNavigation(e, elements, currentIndex, onSelect)
    );
  };

  return { currentIndex, handleKeyDown };
};
