import { useEffect, useCallback } from 'react';

/**
 * Detect Ctrl+Enter (or Cmd+Enter) inside a container and trigger onSubmit.
 * Useful for forms inside modals where the submit button may not have focus.
 */
export function useKeyboardSubmit(
    ref: React.RefObject<HTMLElement | null>,
    onSubmit: () => void,
    enabled = true
) {
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!enabled) return;
            const isModifier = e.ctrlKey || e.metaKey;
            if (isModifier && e.key === 'Enter') {
                e.preventDefault();
                onSubmit();
            }
        },
        [enabled, onSubmit]
    );

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.addEventListener('keydown', handleKeyDown);
        return () => el.removeEventListener('keydown', handleKeyDown);
    }, [ref, handleKeyDown]);
}
