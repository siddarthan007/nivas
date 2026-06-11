'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { Shift } from '@/lib/hooks/useFinance';

interface ShiftsTabProps {
    currentShift: Shift | null;
    isLoading: boolean;
    onStart: (startFloat: number) => void;
    onEnd: (endCashCount: number, notes?: string) => void;
}

export default function ShiftsTab({ currentShift, isLoading, onStart, onEnd }: ShiftsTabProps) {
    const [startFloat, setStartFloat] = useState(0);
    const [endCashCount, setEndCashCount] = useState(0);
    const [notes, setNotes] = useState('');

    if (currentShift) {
        return (
            <div style={{
                backgroundColor: 'var(--notion-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)',
                padding: 'var(--space-6)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--notion-green-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Clock size={24} style={{ color: 'var(--notion-green)' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            Shift Active
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                            Started: {new Date(currentShift.startTime).toLocaleString()}
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-2)' }}>
                        Starting Float: NPR {(parseFloat(currentShift.startFloat) || 0).toLocaleString()}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <Input
                        type="number"
                        min={0}
                        value={endCashCount || ''}
                        onChange={e => setEndCashCount(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        placeholder="Count cash in drawer"
                    />
                </div>
                <Input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="End of shift notes (optional)"
                    style={{ marginBottom: 'var(--space-3)' }}
                />
                <Button onClick={() => onEnd(endCashCount, notes)} disabled={isLoading} style={{ width: '100%' }}>
                    End Shift & Count Cash
                </Button>
            </div>
        );
    }

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-6)',
            textAlign: 'center',
        }}>
            <Clock size={48} style={{ color: 'var(--notion-text-secondary)', opacity: 0.5, marginBottom: 'var(--space-4)' }} />
            <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--notion-text)', marginBottom: 'var(--space-4)' }}>
                No Active Shift
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
                <Input
                    type="number"
                    min={0}
                    value={startFloat || ''}
                    onChange={e => setStartFloat(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                    placeholder="Starting float amount"
                    style={{ maxWidth: '200px' }}
                />
            </div>
            <Button onClick={() => onStart(startFloat)} disabled={isLoading}>
                Start Shift
            </Button>
        </div>
    );
}
