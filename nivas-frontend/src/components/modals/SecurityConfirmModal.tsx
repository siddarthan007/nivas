import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface SecurityConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
}

export default function SecurityConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    isDestructive = false
}: SecurityConfirmModalProps) {
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) {
            toast.error('Please enter your password to confirm');
            return;
        }

        setIsSubmitting(true);
        try {
            // Verify password
            await api.post('/iam/verify-password', { password });

            // Proceed
            await onConfirm();
            setPassword('');
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'Incorrect password');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{
                    display: 'flex',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    backgroundColor: isDestructive ? 'var(--notion-red-bg)' : 'var(--notion-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    color: isDestructive ? 'var(--notion-red)' : 'var(--notion-text)',
                    fontSize: '14px'
                }}>
                    <ShieldAlert size={20} style={{ flexShrink: 0 }} />
                    <p>{message}</p>
                </div>

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Admin Password *
                    </label>
                    <Input
                        type="password"
                        value={password}
                        onChange={(e: any) => setPassword(e.target.value)}
                        placeholder="Enter your password to confirm"
                        required
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                            flex: 1,
                            backgroundColor: isDestructive ? 'var(--notion-red)' : undefined,
                            color: isDestructive ? 'white' : undefined
                        }}
                    >
                        {isSubmitting ? 'Verifying...' : confirmText}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
