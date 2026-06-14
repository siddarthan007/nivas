import { useState } from "react";
import { Plus, CheckSquare, Calendar, Key, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import { useSystemHealth } from "@/lib/contexts/SystemHealthContext";
import { useAuth } from "@/lib/contexts/AuthContext";

export default function GlobalActionMenu() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const { entropy, setEntropy } = useSystemHealth();

    // ... existing modal logic

    const handleAction = (action: string) => {
        setIsOpen(false);
        window.dispatchEvent(new CustomEvent(`open-${action}-modal`));
    };

    const userRole = user?.role?.name;
    const isAdminOrManager = userRole === "ADMIN" || userRole === "MANAGER" || userRole === "Owner" || user?.userType === "SUPER_ADMIN";

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--notion-blue)] text-[var(--foreground-inverse)] rounded-[var(--radius-sm)] text-sm font-medium hover:bg-opacity-90 transition-colors"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    backgroundColor: 'var(--notion-blue)',
                    color: 'var(--foreground-inverse)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 500
                }}
            >
                <Plus size={16} />
                <span className="hidden sm:inline">New</span>
            </button>

            {isOpen && (
                <>
                    {/* ... backdrop ... */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />

                    <div
                        className="absolute right-0 top-full mt-2 w-56 bg-[var(--notion-bg)] border border-[var(--notion-border)] rounded-[var(--radius-md)] shadow-lg z-50 overflow-hidden"
                        style={{
                            /* ... styles ... */
                            position: 'absolute', right: 0, top: '100%', marginTop: '8px', zIndex: 50,
                            backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)',
                            borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden'
                        }}
                    >
                        <div className="py-1">
                            {/* ... Create New header ... */}
                            <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--notion-text-muted)', textTransform: 'uppercase' }}>
                                System Health (Debug)
                            </div>
                            <div style={{ padding: '0 12px 12px 12px' }}>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={entropy}
                                    onChange={(e) => setEntropy(Number(e.target.value))}
                                    style={{ width: '100%', cursor: 'pointer' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--notion-text-muted)' }}>
                                    <span>Blooming</span>
                                    <span>{entropy}%</span>
                                    <span>Decayed</span>
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid var(--notion-border)', margin: '4px 0' }} />

                            <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--notion-text-muted)', textTransform: 'uppercase' }}>
                                Create New
                            </div>

                            {/* ... buttons ... */}
                            {/* Copy existing buttons here exactly or see if we can just inject into list loop? No, easier to replace block */}

                            <button onClick={() => handleAction('task')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--notion-text)', background: 'transparent', border: 'none', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--notion-bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <div style={{ padding: '4px', borderRadius: '4px', background: 'var(--notion-blue-bg)', color: 'var(--notion-blue)' }}><CheckSquare size={16} /></div>
                                Task
                            </button>

                            <button onClick={() => handleAction('leave')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--notion-text)', background: 'transparent', border: 'none', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--notion-bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <div style={{ padding: '4px', borderRadius: '4px', background: 'var(--notion-yellow-bg)', color: 'var(--notion-yellow)' }}><Calendar size={16} /></div>
                                Leave Request
                            </button>

                            {isAdminOrManager && (
                                <button onClick={() => handleAction('credential')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--notion-text)', background: 'transparent', border: 'none', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--notion-bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <div style={{ padding: '4px', borderRadius: '4px', background: 'var(--notion-red-bg)', color: 'var(--notion-red)' }}><Key size={16} /></div>
                                    Client Credential
                                </button>
                            )}

                            {isAdminOrManager && (
                                <button onClick={() => handleAction('staff')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--notion-text)', background: 'transparent', border: 'none', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--notion-bg-secondary)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <div style={{ padding: '4px', borderRadius: '4px', background: 'var(--notion-green-bg)', color: 'var(--notion-green)' }}><UserPlus size={16} /></div>
                                    Staff Member
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}