'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import type { RecordPaymentPayload, Payment } from '@/lib/hooks/useFinance';

interface RecordPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: RecordPaymentPayload) => Promise<boolean>;
}

export default function RecordPaymentModal({ isOpen, onClose, onSubmit }: RecordPaymentModalProps) {
    const [formData, setFormData] = useState<RecordPaymentPayload>({
        amount: 0,
        paymentMethod: 'CASH',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const payload: RecordPaymentPayload = { ...formData };
        if (!payload.bookingId) delete payload.bookingId;
        if (!payload.transactionId) delete payload.transactionId;
        if (!payload.notes) delete payload.notes;
        const success = await onSubmit(payload);
        setIsSubmitting(false);
        if (success) {
            setFormData({ amount: 0, paymentMethod: 'CASH' });
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Record Payment">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Booking ID (optional)
                    </label>
                    <Input
                        type="text"
                        value={formData.bookingId || ''}
                        onChange={e => setFormData({ ...formData, bookingId: e.target.value })}
                        placeholder="Link payment to a booking"
                    />
                </div>

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Amount (Rs ) *
                    </label>
                    <Input
                        type="number"
                        min={0}
                        value={formData.amount}
                        onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                        required
                    />
                </div>

                <Select
                    label="Payment Method *"
                    value={formData.paymentMethod}
                    onChange={e => setFormData({ ...formData, paymentMethod: e.target.value as Payment['paymentMethod'] })}
                    options={[
                        { value: 'CASH', label: 'Cash' },
                        { value: 'CARD', label: 'Card' },
                        { value: 'ESEWA', label: 'eSewa' },
                        { value: 'KHALTI', label: 'Khalti' },
                        { value: 'FONEPAY', label: 'Fonepay' },
                        { value: 'CONNECT_IPS', label: 'Connect IPS' },
                        { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                        { value: 'OTHER', label: 'Other' },
                    ]}
                    fullWidth
                />

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Transaction ID
                    </label>
                    <Input
                        type="text"
                        value={formData.transactionId || ''}
                        onChange={e => setFormData({ ...formData, transactionId: e.target.value })}
                        placeholder="For digital payments"
                    />
                </div>

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Notes
                    </label>
                    <Input
                        type="text"
                        value={formData.notes || ''}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Optional notes"
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || formData.amount <= 0} style={{ flex: 1 }}>
                        {isSubmitting ? 'Recording...' : 'Record Payment'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
