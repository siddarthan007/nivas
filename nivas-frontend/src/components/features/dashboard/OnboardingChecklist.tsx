import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from '@/lib/router';
import { Check, Circle, X, Rocket } from 'lucide-react';

interface Step { id: string; label: string; done: boolean; href: string; optional?: boolean }
interface Checklist { steps: Step[]; completed: number; total: number; isComplete: boolean }

// New-tenant setup checklist. Auto-hides once required steps are done. Dismiss
// is session-only (component state) — NOT persisted, so it never leaks across
// devices/users. Only rendered for owner/manager (gated by the parent).
export default function OnboardingChecklist() {
    const router = useRouter();
    const [data, setData] = useState<Checklist | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        api.get<Checklist>('/onboarding/checklist').then(r => setData(r.data || null)).catch(() => {});
    }, []);

    if (dismissed || !data || data.isComplete) return null;

    const pct = Math.round((data.completed / data.total) * 100);

    return (
        <div style={{ background: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--notion-blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--notion-blue)' }}><Rocket size={18} /></div>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--notion-text)' }}>Finish setting up your hotel</div>
                        <div style={{ fontSize: 12, color: 'var(--notion-text-secondary)' }}>{data.completed} of {data.total} done</div>
                    </div>
                </div>
                <button onClick={() => setDismissed(true)} title="Hide for now"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--notion-text-muted)', padding: 4 }}><X size={16} /></button>
            </div>

            <div style={{ height: 6, borderRadius: 3, background: 'var(--notion-bg-tertiary)', overflow: 'hidden', marginBottom: 'var(--space-4)' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--notion-blue)', transition: 'width 300ms' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.steps.map(s => (
                    <button key={s.id} onClick={() => router.push(s.href)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                        className="hover-bg">
                        {s.done
                            ? <span style={{ color: 'var(--notion-green)', display: 'flex' }}><Check size={18} /></span>
                            : <span style={{ color: 'var(--notion-text-muted)', display: 'flex' }}><Circle size={18} /></span>}
                        <span style={{ fontSize: 13, color: s.done ? 'var(--notion-text-muted)' : 'var(--notion-text)', textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</span>
                        {s.optional && <span style={{ fontSize: 10, color: 'var(--notion-text-muted)' }}>(optional)</span>}
                    </button>
                ))}
            </div>
        </div>
    );
}
