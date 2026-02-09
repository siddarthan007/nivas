'use client';

import { useCallback, useRef, useEffect, type RefObject } from 'react';

interface UseKeyboardNavigationOptions {
    /** Container ref that holds all navigable elements */
    containerRef: RefObject<HTMLElement>;
    /** Selector for focusable elements (default: inputs, selects, textareas, buttons) */
    selector?: string;
    /** Callback when Enter is pressed on last field (form submission) */
    onSubmit?: () => void;
    /** Enable wrap-around navigation (default: false) */
    wrap?: boolean;
}

interface UseKeyboardNavigationReturn {
    /** Ref callback to attach to container */
    containerProps: {
        ref: RefObject<HTMLElement>;
        onKeyDown: (e: React.KeyboardEvent) => void;
    };
    /** Focus specific field by index */
    focusField: (index: number) => void;
    /** Focus next field */
    focusNext: () => void;
    /** Focus previous field */
    focusPrevious: () => void;
    /** Get current focused field index */
    getCurrentIndex: () => number;
}

/**
 * Hook to enable keyboard navigation within forms and UI containers.
 * Supports:
 * - Tab/Shift+Tab: Move between fields (enhanced visual feedback)
 * - Enter: Submit form or move to next field
 * - Escape: Blur current field
 * - Arrow keys: Navigate within select/dropdown components
 */
export function useKeyboardNavigation({
    containerRef,
    selector = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
    onSubmit,
    wrap = false,
}: UseKeyboardNavigationOptions): UseKeyboardNavigationReturn {
    const currentIndexRef = useRef<number>(-1);

    const getFocusableElements = useCallback((): HTMLElement[] => {
        if (!containerRef.current) return [];
        return Array.from(containerRef.current.querySelectorAll(selector)) as HTMLElement[];
    }, [containerRef, selector]);

    const getCurrentIndex = useCallback((): number => {
        const elements = getFocusableElements();
        const activeElement = document.activeElement as HTMLElement;
        return elements.indexOf(activeElement);
    }, [getFocusableElements]);

    const focusField = useCallback((index: number) => {
        const elements = getFocusableElements();
        if (index >= 0 && index < elements.length) {
            elements[index]?.focus();
            currentIndexRef.current = index;
        }
    }, [getFocusableElements]);

    const focusNext = useCallback(() => {
        const elements = getFocusableElements();
        const currentIndex = getCurrentIndex();
        let nextIndex = currentIndex + 1;

        if (nextIndex >= elements.length) {
            if (wrap) {
                nextIndex = 0;
            } else if (onSubmit) {
                onSubmit();
                return;
            } else {
                return;
            }
        }

        focusField(nextIndex);
    }, [getFocusableElements, getCurrentIndex, focusField, wrap, onSubmit]);

    const focusPrevious = useCallback(() => {
        const elements = getFocusableElements();
        const currentIndex = getCurrentIndex();
        let prevIndex = currentIndex - 1;

        if (prevIndex < 0) {
            if (wrap) {
                prevIndex = elements.length - 1;
            } else {
                return;
            }
        }

        focusField(prevIndex);
    }, [getFocusableElements, getCurrentIndex, focusField, wrap]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        const isTextarea = tagName === 'textarea';
        const isSelect = tagName === 'select';
        const isInput = tagName === 'input';
        const inputType = isInput ? (target as HTMLInputElement).type : '';

        switch (e.key) {
            case 'Enter':
                // Don't intercept Enter for textareas (multiline) or buttons
                if (isTextarea || tagName === 'button') return;

                // For submit buttons, let default behavior happen
                if (isInput && inputType === 'submit') return;

                e.preventDefault();
                focusNext();
                break;

            case 'Escape':
                e.preventDefault();
                target.blur();
                break;

            case 'ArrowDown':
                // For select elements, let browser handle arrow keys
                if (isSelect) return;

                // For other elements, move to next field
                e.preventDefault();
                focusNext();
                break;

            case 'ArrowUp':
                // For select elements, let browser handle arrow keys
                if (isSelect) return;

                // For other elements, move to previous field
                e.preventDefault();
                focusPrevious();
                break;

            case 'Tab':
                // Enhanced Tab behavior - update current index tracking
                // Browser handles actual focus, we just track it
                currentIndexRef.current = getCurrentIndex() + (e.shiftKey ? -1 : 1);
                break;
        }
    }, [focusNext, focusPrevious, getCurrentIndex]);

    // Track focus changes within container
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleFocusIn = () => {
            currentIndexRef.current = getCurrentIndex();
        };

        container.addEventListener('focusin', handleFocusIn);
        return () => container.removeEventListener('focusin', handleFocusIn);
    }, [containerRef, getCurrentIndex]);

    return {
        containerProps: {
            ref: containerRef,
            onKeyDown: handleKeyDown,
        },
        focusField,
        focusNext,
        focusPrevious,
        getCurrentIndex,
    };
}

export default useKeyboardNavigation;
