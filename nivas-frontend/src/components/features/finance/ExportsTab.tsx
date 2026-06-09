'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import Button from '@/components/ui/Button';
import CustomDatePicker from '@/components/ui/DatePicker';

interface ExportsTabProps {
    onExportTally: (date?: string, type?: 'sales' | 'purchase' | 'receipt') => void;
    onExportAnnex5: (date?: string, type?: 'sales' | 'purchase') => void;
}

export default function ExportsTab({ onExportTally, onExportAnnex5 }: ExportsTabProps) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            {/* Tally Exports */}
            <div style={{
                backgroundColor: 'var(--notion-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)',
                padding: 'var(--space-4)',
            }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-3)' }}>
                    Tally Exports (XML)
                </div>
                <div style={{ marginBottom: 'var(--space-3)' }}>
                    <CustomDatePicker
                        selected={date ? new Date(date) : null}
                        onChange={d => setDate(d ? d.toISOString().split('T')[0] : '')}
                        placeholder="Select date"
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={() => onExportTally(date, 'sales')}>
                        <Download size={14} style={{ marginRight: '6px' }} />
                        Sales XML
                    </Button>
                    <Button variant="secondary" onClick={() => onExportTally(date, 'purchase')}>
                        <Download size={14} style={{ marginRight: '6px' }} />
                        Purchase XML
                    </Button>
                    <Button variant="secondary" onClick={() => onExportTally(date, 'receipt')}>
                        <Download size={14} style={{ marginRight: '6px' }} />
                        Receipt XML
                    </Button>
                </div>
            </div>

            {/* IRD Annex 5 */}
            <div style={{
                backgroundColor: 'var(--notion-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--notion-border)',
                padding: 'var(--space-4)',
            }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-3)' }}>
                    IRD Annex 5 (CSV)
                </div>
                <div style={{ marginBottom: 'var(--space-3)' }}>
                    <CustomDatePicker
                        selected={date ? new Date(date) : null}
                        onChange={d => setDate(d ? d.toISOString().split('T')[0] : '')}
                        placeholder="Select date"
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={() => onExportAnnex5(date, 'sales')}>
                        <Download size={14} style={{ marginRight: '6px' }} />
                        Sales Register
                    </Button>
                    <Button variant="secondary" onClick={() => onExportAnnex5(date, 'purchase')}>
                        <Download size={14} style={{ marginRight: '6px' }} />
                        Purchase Register
                    </Button>
                </div>
            </div>
        </div>
    );
}
