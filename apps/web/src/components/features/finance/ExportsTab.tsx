'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import Button from '@/components/ui/Button';
import DateField from '@/components/ui/DateField';

interface ExportsTabProps {
    onExportTally: (date?: string, type?: 'sales' | 'purchase' | 'receipt') => void;
    onExportAnnex5: (date?: string, type?: 'sales' | 'purchase') => void;
}

export default function ExportsTab({ onExportTally, onExportAnnex5 }: ExportsTabProps) {
    const [date, setDate] = useState('');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 640 }}>
            <div style={{
                padding: 'var(--space-5)',
                backgroundColor: 'var(--notion-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)',
            }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 'var(--space-3)', color: 'var(--notion-text)' }}>
                    Export date (optional)
                </h3>
                <DateField value={date} onChange={setDate} placeholder="Select date" />
                <p style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginTop: '8px' }}>
                    Leave blank to export all available records.
                </p>
            </div>

            <div style={{
                padding: 'var(--space-5)',
                backgroundColor: 'var(--notion-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)',
            }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileSpreadsheet size={18} /> Tally exports
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <Button variant="secondary" onClick={() => onExportTally(date || undefined, 'sales')}>
                        <Download size={14} style={{ marginRight: '6px' }} /> Sales
                    </Button>
                    <Button variant="secondary" onClick={() => onExportTally(date || undefined, 'purchase')}>
                        <Download size={14} style={{ marginRight: '6px' }} /> Purchase
                    </Button>
                    <Button variant="secondary" onClick={() => onExportTally(date || undefined, 'receipt')}>
                        <Download size={14} style={{ marginRight: '6px' }} /> Receipt
                    </Button>
                </div>
            </div>

            <div style={{
                padding: 'var(--space-5)',
                backgroundColor: 'var(--notion-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)',
            }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--notion-text)' }}>
                    IRD Annex 5
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <Button variant="secondary" onClick={() => onExportAnnex5(date || undefined, 'sales')}>
                        <Download size={14} style={{ marginRight: '6px' }} /> Sales Annex 5
                    </Button>
                    <Button variant="secondary" onClick={() => onExportAnnex5(date || undefined, 'purchase')}>
                        <Download size={14} style={{ marginRight: '6px' }} /> Purchase Annex 5
                    </Button>
                </div>
            </div>
        </div>
    );
}
