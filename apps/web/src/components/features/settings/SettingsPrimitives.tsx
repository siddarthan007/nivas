'use client';

import { ToggleLeft, ToggleRight } from 'lucide-react';

export function ToggleSwitch({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: 'var(--space-4)',
                backgroundColor: 'var(--notion-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 150ms ease',
            }}
        >
            <span style={{ fontSize: '14px', color: 'var(--notion-text)' }}>{label}</span>
            {enabled ? (
                <ToggleRight size={24} style={{ color: 'var(--notion-green)' }} />
            ) : (
                <ToggleLeft size={24} style={{ color: 'var(--notion-text-secondary)' }} />
            )}
        </button>
    );
}

export function SettingsSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-5)',
            marginBottom: 'var(--space-5)',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-5)',
                paddingBottom: 'var(--space-4)',
                borderBottom: '1px solid var(--notion-divider)',
            }}>
                <Icon size={20} style={{ color: 'var(--notion-blue)' }} />
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>{title}</h2>
            </div>
            {children}
        </div>
    );
}
