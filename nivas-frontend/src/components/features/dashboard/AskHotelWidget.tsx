import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Sparkles, Send } from 'lucide-react';

const SUGGESTIONS = [
    'How was revenue this week vs last 30 days?',
    'Which room type earns the most?',
    'What is my forecast occupancy for the next 30 days?',
    'Any recurring guest complaints?',
];

// "Ask your hotel" — NL analytics over scoped data (RAG). Hidden unless AI is on.
export default function AskHotelWidget() {
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(false);
    const [thread, setThread] = useState<{ q: string; a: string }[]>([]);

    useEffect(() => {
        api.get<{ enabled: boolean }>('/ai/status').then(r => setEnabled(!!r.data?.enabled)).catch(() => setEnabled(false));
    }, []);

    if (enabled === null || !enabled) return null;

    const ask = async (question: string) => {
        const text = question.trim();
        if (!text || busy) return;
        setBusy(true); setQ('');
        try {
            const res = await api.post<{ answer: string }>('/ai/ask', { question: text });
            setThread(t => [{ q: text, a: res.data?.answer || 'No answer.' }, ...t]);
        } catch (e: any) {
            setThread(t => [{ q: text, a: e?.message || 'Failed to get an answer.' }, ...t]);
        } finally { setBusy(false); }
    };

    return (
        <div style={{ background: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)' }}>
                <Sparkles size={18} style={{ color: 'var(--notion-blue)' }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--notion-text)' }}>Ask your hotel</div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); ask(q); }} style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-3)' }}>
                <input
                    value={q} onChange={e => setQ(e.target.value)} disabled={busy}
                    placeholder="Ask about sales, occupancy, room types, complaints…"
                    style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', background: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: 13 }}
                />
                <button type="submit" disabled={busy || !q.trim()} style={{ padding: '0 14px', border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--notion-blue)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <Send size={14} /> {busy ? '…' : 'Ask'}
                </button>
            </form>

            {thread.length === 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {SUGGESTIONS.map(s => (
                        <button key={s} onClick={() => ask(s)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 14, border: '1px solid var(--notion-border)', background: 'var(--notion-bg)', color: 'var(--notion-text-secondary)', cursor: 'pointer' }}>{s}</button>
                    ))}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxHeight: 320, overflowY: 'auto' }}>
                    {thread.map((m, i) => (
                        <div key={i}>
                            <div style={{ fontSize: 12, color: 'var(--notion-text-muted)', marginBottom: 3 }}>You: {m.q}</div>
                            <div style={{ fontSize: 13, color: 'var(--notion-text)', background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', whiteSpace: 'pre-wrap' }}>{m.a}</div>
                        </div>
                    ))}
                </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--notion-text-muted)', marginTop: 8 }}>Answers are generated from your hotel's own data. Verify figures before acting.</div>
        </div>
    );
}
