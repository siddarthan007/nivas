'use client';

import { useMemo } from 'react';
import { adToBS, formatBSDateEN } from '@/lib/utils/nepaliDate';

interface DualDateProps {
    date?: Date | string | null;
    format?: 'full' | 'compact';
    className?: string;
}

export default function DualDate({ date, format = 'compact', className = '' }: DualDateProps) {
    const { adText, bsText } = useMemo(() => {
        if (!date) return { adText: '', bsText: '' };
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return { adText: '', bsText: '' };

        const bs = adToBS(d);
        const bsFormatted = formatBSDateEN(bs, 'long');

        if (format === 'full') {
            const adFormatted = d.toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            });
            return {
                adText: adFormatted,
                bsText: `${bs.year}-${String(bs.month).padStart(2, '0')}-${String(bs.day).padStart(2, '0')} BS`,
            };
        }

        const adFormatted = d.toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
        });
        return {
            adText: adFormatted,
            bsText: `${String(bs.day).padStart(2, '0')}/${String(bs.month).padStart(2, '0')}`,
        };
    }, [date, format]);

    if (!adText) return <span className={className}>—</span>;

    return (
        <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>{adText}</span>
            <span style={{ color: 'var(--notion-text-secondary)', fontSize: '0.85em' }}>
                ({bsText})
            </span>
        </span>
    );
}
