'use client';

import { useRouter } from '@/lib/router';
import { Users, Building2, Briefcase } from 'lucide-react';

const TABS = [
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'corporate', label: 'Corporate', icon: Building2 },
    { id: 'agents', label: 'Travel Agents', icon: Briefcase },
] as const;

export default function CustomersHubTabs({ activeTab }: { activeTab: string }) {
    const router = useRouter();

    return (
        <div style={{
            display: 'flex',
            gap: '4px',
            backgroundColor: 'var(--notion-bg-secondary)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-6)',
            width: 'fit-content',
        }}>
            {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => router.push(`/hotel/guests?tab=${tab.id}`)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            fontSize: '14px',
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                            backgroundColor: isActive ? 'var(--notion-bg)' : 'transparent',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                        }}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
