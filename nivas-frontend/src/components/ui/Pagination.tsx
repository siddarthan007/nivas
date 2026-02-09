import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
    onPageChange: (page: number) => void;
    onLimitChange?: (limit: number) => void;
}

export default function Pagination({ page, totalPages, total, limit, onPageChange, onLimitChange }: PaginationProps) {
    if (total === 0) return null;

    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-4) var(--space-4)',
            borderTop: '1px solid var(--notion-border)',
            fontSize: '13px',
            color: 'var(--notion-text-secondary)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span>Showing {start}–{end} of {total}</span>
                {onLimitChange && (
                    <select
                        value={limit}
                        onChange={e => onLimitChange(Number(e.target.value))}
                        style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            border: '1px solid var(--notion-border)',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--notion-bg-secondary)',
                            color: 'var(--notion-text)',
                            cursor: 'pointer',
                        }}
                    >
                        {[10, 20, 50, 100].map(n => (
                            <option key={n} value={n}>{n} per page</option>
                        ))}
                    </select>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <PageButton onClick={() => onPageChange(1)} disabled={page <= 1} title="First page">
                    <ChevronsLeft size={14} />
                </PageButton>
                <PageButton onClick={() => onPageChange(page - 1)} disabled={page <= 1} title="Previous page">
                    <ChevronLeft size={14} />
                </PageButton>

                <span style={{ padding: '0 var(--space-3)', fontSize: '13px', fontWeight: '500', color: 'var(--notion-text)' }}>
                    {page} / {totalPages}
                </span>

                <PageButton onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} title="Next page">
                    <ChevronRight size={14} />
                </PageButton>
                <PageButton onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} title="Last page">
                    <ChevronsRight size={14} />
                </PageButton>
            </div>
        </div>
    );
}

function PageButton({ onClick, disabled, title, children }: {
    onClick: () => void;
    disabled: boolean;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--notion-border)',
                backgroundColor: disabled ? 'transparent' : 'var(--notion-bg-secondary)',
                color: disabled ? 'var(--notion-text-tertiary)' : 'var(--notion-text)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                transition: 'background-color 150ms ease',
            }}
            onMouseEnter={e => {
                if (!disabled) e.currentTarget.style.backgroundColor = 'var(--notion-bg-hover)';
            }}
            onMouseLeave={e => {
                if (!disabled) e.currentTarget.style.backgroundColor = 'var(--notion-bg-secondary)';
            }}
        >
            {children}
        </button>
    );
}
