'use client';

import {
    BarChart3,
    BookOpen,
    TrendingUp,
    FileText,
    Clock,
    Download,
    ChevronDown,
    ChevronRight,
    Landmark,
} from 'lucide-react';
import { useState } from 'react';

interface Section {
    id: string;
    label: string;
    icon: React.ElementType;
    children?: { id: string; label: string }[];
}

const SECTIONS: Section[] = [
    { id: 'overview', label: 'Dashboard', icon: BarChart3 },
    {
        id: 'sales',
        label: 'Sales & Receivables',
        icon: FileText,
        children: [
            { id: 'invoices', label: 'Invoices' },
            { id: 'outstanding', label: 'Outstanding / Credit' },
            { id: 'payments', label: 'Payments' },
            { id: 'credit-notes', label: 'Credit Notes' },
            { id: 'customer-ledger', label: 'Customer Ledger' },
        ],
    },
    {
        id: 'accounting',
        label: 'Accounting',
        icon: BookOpen,
        children: [
            { id: 'general-ledger', label: 'General Ledger' },
            { id: 'transactions', label: 'Transaction History' },
            { id: 'profit-loss', label: 'Profit & Loss' },
            { id: 'balance-sheet', label: 'Balance Sheet' },
        ],
    },
    { id: 'revenue', label: 'Revenue Analytics', icon: TrendingUp },
    {
        id: 'operations',
        label: 'Operations',
        icon: Clock,
        children: [
            { id: 'shifts', label: 'Shifts' },
            { id: 'night-audit', label: 'Night Audit' },
        ],
    },
    { id: 'exports', label: 'Exports & Compliance', icon: Download },
];

interface FinanceSidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export default function FinanceSidebar({ activeTab, onTabChange }: FinanceSidebarProps) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set(['sales', 'accounting', 'operations']));

    const toggleSection = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const isActive = (id: string) => activeTab === id;
    const isChildActive = (section: Section) => section.children?.some(c => c.id === activeTab) ?? false;

    return (
        <div style={{
            width: '240px',
            minWidth: '240px',
            height: '100%',
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRight: '1px solid var(--notion-border)',
            display: 'flex',
            flexDirection: 'column',
        }}>
            <div style={{
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0 16px',
                borderBottom: '1px solid var(--notion-divider)',
                flexShrink: 0,
            }}>
                <Landmark size={20} strokeWidth={1.5} style={{ color: 'var(--notion-text-secondary)' }} />
                <span style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--notion-text)',
                    letterSpacing: '-0.01em',
                }}>
                    Finance
                </span>
            </div>

            {/* Scrollable Nav */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '12px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
            }}>
                {SECTIONS.map((section) => {
                    const hasChildren = !!section.children?.length;
                    const isExpanded = expanded.has(section.id);
                    const sectionActive = isActive(section.id);
                    const childActive = isChildActive(section);
                    const active = sectionActive || childActive;

                    return (
                        <div key={section.id}>
                            {/* Section header button */}
                            <button
                                onClick={() => {
                                    if (hasChildren) toggleSection(section.id);
                                    onTabChange(section.id);
                                }}
                                className="hover-bg"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '6px 12px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: 'none',
                                    backgroundColor: active ? 'var(--notion-bg-tertiary)' : 'transparent',
                                    color: active ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                                    fontSize: '14px',
                                    fontWeight: active ? 600 : 500,
                                    cursor: 'pointer',
                                    transition: 'background-color 0.1s ease, color 0.1s ease',
                                    textAlign: 'left',
                                    position: 'relative',
                                }}
                            >
                                {active && (
                                    <span style={{
                                        position: 'absolute',
                                        left: 0,
                                        top: '4px',
                                        bottom: '4px',
                                        width: '3px',
                                        borderRadius: '0 2px 2px 0',
                                        backgroundColor: 'var(--notion-blue)',
                                    }} />
                                )}
                                <section.icon size={18} strokeWidth={1.5} />
                                <span style={{ flex: 1 }}>{section.label}</span>
                                {hasChildren && (
                                    isExpanded
                                        ? <ChevronDown size={14} strokeWidth={2} />
                                        : <ChevronRight size={14} strokeWidth={2} />
                                )}
                            </button>

                            {/* Child items */}
                            {hasChildren && isExpanded && (
                                <div style={{
                                    paddingLeft: '32px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                    marginTop: '2px',
                                }}>
                                    {section.children!.map(child => (
                                        <button
                                            key={child.id}
                                            onClick={() => onTabChange(child.id)}
                                            className="hover-bg"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '5px 12px',
                                                borderRadius: 'var(--radius-sm)',
                                                border: 'none',
                                                backgroundColor: isActive(child.id) ? 'var(--notion-bg-tertiary)' : 'transparent',
                                                color: isActive(child.id) ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                                                fontSize: '13px',
                                                fontWeight: isActive(child.id) ? 500 : 400,
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                transition: 'background-color 0.1s ease, color 0.1s ease',
                                                position: 'relative',
                                            }}
                                        >
                                            {isActive(child.id) && (
                                                <span style={{
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: '3px',
                                                    bottom: '3px',
                                                    width: '3px',
                                                    borderRadius: '0 2px 2px 0',
                                                    backgroundColor: 'var(--notion-blue)',
                                                }} />
                                            )}
                                            <span style={{
                                                width: '5px',
                                                height: '5px',
                                                borderRadius: '50%',
                                                backgroundColor: isActive(child.id) ? 'var(--notion-blue)' : 'var(--notion-text-muted)',
                                                marginRight: '10px',
                                                flexShrink: 0,
                                            }} />
                                            {child.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

        </div>
    );
}
