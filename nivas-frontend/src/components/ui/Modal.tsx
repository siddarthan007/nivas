'use client';

import { useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showClose?: boolean;
    closeOnOverlay?: boolean;
    closeOnEscape?: boolean;
    footer?: ReactNode;
}

const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    showClose = true,
    closeOnOverlay = true,
    closeOnEscape = true,
    footer,
}: ModalProps) => {
    const sizeMap = {
        sm: '400px',
        md: '480px',
        lg: '640px',
        xl: '800px',
    };

    const handleEscape = useCallback(
        (e: KeyboardEvent) => {
            if (closeOnEscape && e.key === 'Escape') {
                onClose();
            }
        },
        [closeOnEscape, onClose]
    );

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (closeOnOverlay && e.target === e.currentTarget) {
            onClose();
        }
    };

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';

            // Focus trap: Focus first focusable element on open
            setTimeout(() => {
                const modal = document.querySelector('.modal') as HTMLElement;
                if (modal) {
                    const focusable = modal.querySelectorAll(
                        'button, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                    ) as NodeListOf<HTMLElement>;
                    if (focusable.length > 0) {
                        focusable[0]?.focus();
                    }
                }
            }, 0);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleEscape]);

    // Tab trap handler
    const handleTabTrap = useCallback((e: KeyboardEvent) => {
        if (e.key !== 'Tab' || !isOpen) return;

        const modal = document.querySelector('.modal') as HTMLElement;
        if (!modal) return;

        const focusable = modal.querySelectorAll(
            'button, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) as NodeListOf<HTMLElement>;

        if (focusable.length === 0) return;

        const firstFocusable = focusable[0];
        const lastFocusable = focusable[focusable.length - 1];

        if (e.shiftKey) {
            // Shift+Tab: wrap to last element
            if (document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable?.focus();
            }
        } else {
            // Tab: wrap to first element
            if (document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable?.focus();
            }
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleTabTrap);
        }
        return () => {
            document.removeEventListener('keydown', handleTabTrap);
        };
    }, [isOpen, handleTabTrap]);

    if (!isOpen) return null;

    const modalContent = (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div
                className="modal"
                style={{
                    maxWidth: sizeMap[size],
                    maxHeight: 'calc(100vh - 40px)', // Prevent going off screen
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'visible' // Allow dropdowns to render outside modal bounds
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? 'modal-title' : undefined}
            >
                {(title || showClose) && (
                    <div className="modal-header">
                        {title && <h2 id="modal-title" className="modal-title">{title}</h2>}
                        {showClose && (
                            <button
                                type="button"
                                className="modal-close"
                                onClick={onClose}
                                aria-label="Close modal"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                )}
                <div className="modal-body" style={{ overflowY: 'auto' }}>{children}</div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    );

    // Only render portal on client
    if (typeof window === 'undefined') return null;

    return createPortal(modalContent, document.body);
};

export default Modal;