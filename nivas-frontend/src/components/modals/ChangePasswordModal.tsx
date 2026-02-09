import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Lock, X } from 'lucide-react'; // CheckWrapper is likely valid or use Check
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    isAdminReset?: boolean;
    userName?: string;
    onSubmit?: (password: string) => Promise<void>;
}

export default function ChangePasswordModal({ isOpen, onClose, isAdminReset, userName, onSubmit }: ChangePasswordModalProps) {
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.newPassword !== formData.confirmPassword) {
            toast.error("New passwords don't match");
            return;
        }

        if (formData.newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setIsSubmitting(true);
        try {
            if (isAdminReset && onSubmit) {
                // Admin Reset Flow
                await onSubmit(formData.newPassword);
                onClose();
            } else {
                // Self-Service Change Password Flow
                await api.post('/iam/change-password', {
                    currentPassword: formData.currentPassword,
                    newPassword: formData.newPassword
                });
                toast.success('Password changed successfully');
                onClose();
            }
            setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err: any) {
            if (!isAdminReset) toast.error(err.message || 'Failed to change password');
            // If admin reset, parent handles error toast usually, or we catch here if onSubmit throws
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isAdminReset ? `Reset Password: ${userName || 'User'}` : "Change Password"}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-2)' }}>
                    <div style={{ padding: '8px', backgroundColor: 'var(--notion-bg)', borderRadius: '50%' }}>
                        <Lock size={20} className="text-notion-text-secondary" />
                    </div>
                    <div>
                        <p style={{ fontSize: '14px', fontWeight: '500' }}>{isAdminReset ? 'Set New Password' : 'Secure your account'}</p>
                        <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                            {isAdminReset ? 'Create a new password for this user.' : 'Choose a strong password to protect your data.'}
                        </p>
                    </div>
                </div>

                {!isAdminReset && (
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Current Password *</label>
                        <Input
                            type="password"
                            value={formData.currentPassword}
                            onChange={(e: any) => setFormData({ ...formData, currentPassword: e.target.value })}
                            required
                            placeholder="Enter current password"
                        />
                    </div>
                )}

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>New Password *</label>
                    <Input
                        type="password"
                        value={formData.newPassword}
                        onChange={(e: any) => setFormData({ ...formData, newPassword: e.target.value })}
                        required
                        placeholder="Min 6 characters"
                    />
                </div>

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Confirm New Password *</label>
                    <Input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e: any) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        required
                        placeholder="Re-enter new password"
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} style={{ flex: 1 }}>
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : (isAdminReset ? 'Reset Password' : 'Update Password')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
