import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
    icon?: ReactNode;
    title?: string;
    description?: string;
    action?: ReactNode;
}

const EmptyState = ({
    icon,
    title = 'No data found',
    description,
    action,
}: EmptyStateProps) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--notion-text-secondary)',
            width: '100%',
            height: '100%',
            minHeight: '300px'
        }}>
            <div style={{
                marginBottom: '16px',
                color: 'var(--notion-text-muted)',
                opacity: 0.5
            }}>
                {icon || <Inbox size={48} strokeWidth={1} />}
            </div>

            <h3 style={{
                fontSize: '16px',
                fontWeight: '500',
                color: 'var(--notion-text)',
                marginBottom: '8px'
            }}>
                {title}
            </h3>

            {description && (
                <p style={{
                    fontSize: '14px',
                    color: 'var(--notion-text-secondary)',
                    maxWidth: '400px',
                    marginBottom: action ? '24px' : '0'
                }}>
                    {description}
                </p>
            )}

            {action && (
                <div>{action}</div>
            )}
        </div>
    );
};

export default EmptyState;