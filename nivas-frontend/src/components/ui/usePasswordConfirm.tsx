import { useState, useCallback } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';

interface PromptState {
    open: boolean;
    title: string;
    message?: string;
    resolve?: (password: string | null) => void;
}

/**
 * Promise-based password step-up. Usage:
 *   const { confirm, modal } = usePasswordConfirm();
 *   const pw = await confirm('Void payment', 'Re-enter your password to confirm.');
 *   if (!pw) return;            // cancelled
 *   await api.post(url, { ...body, confirmPassword: pw });
 *   ...
 *   return <>{modal}{rest}</>;
 */
export function usePasswordConfirm() {
    const [state, setState] = useState<PromptState>({ open: false, title: '' });
    const [password, setPassword] = useState('');

    const confirm = useCallback((title: string, message?: string) => {
        setPassword('');
        return new Promise<string | null>((resolve) => {
            setState({ open: true, title, message, resolve });
        });
    }, []);

    const close = (value: string | null) => {
        state.resolve?.(value);
        setState({ open: false, title: '' });
        setPassword('');
    };

    const modal = (
        <Modal isOpen={state.open} onClose={() => close(null)} title={state.title}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', margin: 0 }}>
                    {state.message || 'This is a sensitive action. Re-enter your password to continue.'}
                </p>
                <Input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && password) close(password); }}
                    placeholder="Your password"
                    fullWidth
                />
                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={() => close(null)}>Cancel</Button>
                    <Button onClick={() => close(password)} disabled={!password}>Confirm</Button>
                </div>
            </div>
        </Modal>
    );

    return { confirm, modal };
}
