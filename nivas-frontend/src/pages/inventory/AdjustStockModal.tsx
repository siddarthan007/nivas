import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { InventoryItem } from '@/lib/types/api.types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    item?: InventoryItem;
    onAdjust: (id: number, adj: number, reason: string) => void;
}

export default function AdjustStockModal({ isOpen, onClose, item, onAdjust }: Props) {
    const [adj, setAdj] = useState<number>(0);
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setAdj(0);
            setReason('');
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!item) return;
        setSubmitting(true);
        await onAdjust(item.id, adj, reason);
        setSubmitting(false);
        onClose();
    };

    const newStock = Math.max(0, (item?.currentStock || 0) + adj);
    const arrowColor = newStock < (item?.currentStock || 0) ? 'var(--notion-red)' : 'var(--notion-green)';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Adjust Stock: ${item?.name || ''}`}>
            <form
                onSubmit={handleSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px',
                        background: 'var(--notion-bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                    }}
                >
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>
                            Current
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 700 }}>
                            {item?.currentStock || 0}
                        </div>
                    </div>
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={arrowColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                    </svg>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>
                            New
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: arrowColor }}>
                            {newStock}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <Input
                        type="number"
                        label="Adjustment (+/-)"
                        value={adj || ''}
                        onChange={e => setAdj(e.target.value === '' ? 0 : parseInt(e.target.value))}
                        placeholder="+10 or -5"
                        required
                    />
                    <Input
                        label="Reason"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="Damaged, found, etc."
                        required
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        style={{ flex: 1 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={submitting || !reason}
                        style={{ flex: 1 }}
                    >
                        {submitting ? 'Saving...' : 'Save Adjustment'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
