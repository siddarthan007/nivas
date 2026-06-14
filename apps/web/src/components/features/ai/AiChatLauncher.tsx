import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { renderMarkdownSafe } from '@/lib/utils/markdown';
import { Sparkles, X, Send, Check, ShoppingCart, ConciergeBell } from 'lucide-react';

interface OrderAction { type: 'ORDER'; items: { menuItemId: number; name: string; price: number; quantity: number; lineTotal: number }[]; total: number; currency: string }
interface HkAction { type: 'HOUSEKEEPING'; taskType: 'CLEANING' | 'TOWELS' | 'AMENITIES' | 'MAINTENANCE' }
type Action = OrderAction | HkAction;

type Msg = { role: 'user' | 'assistant'; content: string; action?: Action | null; actionState?: 'pending' | 'done' | 'cancelled' };

interface Props {
    endpoint: string;
    field: 'question' | 'message';
    sendHistory?: boolean;
    title: string;
    subtitle?: string;
    intro: string;
    suggestions?: string[];
    statusEndpoint?: string;
    accent?: string;
}

export default function AiChatLauncher({ endpoint, field, sendHistory, title, subtitle, intro, suggestions = [], statusEndpoint = '/ai/status', accent = 'var(--notion-blue)' }: Props) {
    const [available, setAvailable] = useState<boolean | null>(null);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [input, setInput] = useState('');
    const [msgs, setMsgs] = useState<Msg[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        api.get<{ enabled: boolean }>(statusEndpoint).then(r => setAvailable(!!r.data?.enabled)).catch(() => setAvailable(false));
    }, [statusEndpoint]);

    useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy]);

    if (!available) return null;

    const send = async (text: string) => {
        const q = text.trim();
        if (!q || busy) return;
        setInput('');
        setMsgs(m => [...m, { role: 'user', content: q }]);
        setBusy(true);
        try {
            const body: any = { [field]: q };
            if (sendHistory) body.history = msgs.slice(-6).map(({ role, content }) => ({ role, content }));
            const res = await api.post<{ answer?: string; reply?: string; action?: Action | null }>(endpoint, body);
            const a = res.data?.answer ?? res.data?.reply ?? 'No response.';
            setMsgs(m => [...m, { role: 'assistant', content: a, action: res.data?.action || null, actionState: res.data?.action ? 'pending' : undefined }]);
        } catch (e: any) {
            setMsgs(m => [...m, { role: 'assistant', content: e?.message || 'Something went wrong. Please try again.' }]);
        } finally { setBusy(false); }
    };

    // Execute a confirmed action via the EXISTING validated guest endpoints (the AI
    // never executes — server already re-validated items/prices before this point).
    const confirmAction = async (idx: number) => {
        const msg = msgs[idx];
        if (!msg?.action || msg.actionState !== 'pending') return;
        setMsgs(m => m.map((x, i) => i === idx ? { ...x, actionState: 'done' } : x)); // optimistic lock
        try {
            if (msg.action.type === 'ORDER') {
                await api.post('/guest/actions/order', { items: msg.action.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity })), deliveryTo: 'ROOM' });
                setMsgs(m => [...m, { role: 'assistant', content: '✅ **Order placed.** The kitchen has been notified — it will arrive at your room shortly.' }]);
            } else {
                await api.post('/guest/actions/request-housekeeping', { taskType: msg.action.taskType });
                setMsgs(m => [...m, { role: 'assistant', content: '✅ **Request sent.** Housekeeping has been notified.' }]);
            }
        } catch (e: any) {
            setMsgs(m => m.map((x, i) => i === idx ? { ...x, actionState: 'pending' } : x)); // revert lock
            setMsgs(m => [...m, { role: 'assistant', content: `⚠️ ${e?.message || 'Could not complete that. Please try the menu buttons.'}` }]);
        }
    };
    const cancelAction = (idx: number) => setMsgs(m => m.map((x, i) => i === idx ? { ...x, actionState: 'cancelled' } : x));

    const money = (n: number, c: string) => `${c} ${Math.round(n).toLocaleString()}`;

    return (
        <>
            {!open && (
                <button onClick={() => setOpen(true)} aria-label={`Open ${title}`}
                    style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer', background: accent, color: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 120ms' }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')} onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                    <Sparkles size={24} />
                </button>
            )}

            {open && (
                <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, width: 'min(384px, calc(100vw - 32px))', height: 'min(580px, calc(100vh - 48px))', background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.30)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ background: accent, color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Sparkles size={18} />
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
                                {subtitle && <div style={{ fontSize: 11, opacity: 0.85 }}>{subtitle}</div>}
                            </div>
                        </div>
                        <button onClick={() => setOpen(false)} aria-label="Close chat" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                    </div>

                    <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--notion-bg-secondary)' }}>
                        {msgs.length === 0 && <div style={{ fontSize: 13, color: 'var(--notion-text-secondary)', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(intro) }} />}
                        {msgs.map((m, i) => (
                            <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div className="ai-md" style={{ padding: '8px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.55, background: m.role === 'user' ? accent : 'var(--notion-bg)', color: m.role === 'user' ? '#fff' : 'var(--notion-text)', border: m.role === 'user' ? 'none' : '1px solid var(--notion-border)', wordBreak: 'break-word' }}
                                    {...(m.role === 'assistant' ? { dangerouslySetInnerHTML: { __html: renderMarkdownSafe(m.content) } } : { children: m.content })} />

                                {/* Action confirmation card */}
                                {m.action && (
                                    <div style={{ border: `1px solid ${accent}`, borderRadius: 12, padding: 12, background: 'var(--notion-bg)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: accent, marginBottom: 8 }}>
                                            {m.action.type === 'ORDER' ? <ShoppingCart size={14} /> : <ConciergeBell size={14} />}
                                            {m.action.type === 'ORDER' ? 'Confirm your order' : 'Confirm request'}
                                        </div>
                                        {m.action.type === 'ORDER' ? (
                                            <>
                                                {m.action.items.map((it, k) => (
                                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--notion-text)', marginBottom: 3 }}>
                                                        <span>{it.quantity}× {it.name}</span>
                                                        <span>{money(it.lineTotal, (m.action as OrderAction).currency)}</span>
                                                    </div>
                                                ))}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--notion-text)', borderTop: '1px solid var(--notion-border)', marginTop: 6, paddingTop: 6 }}>
                                                    <span>Total (to room)</span><span>{money(m.action.total, m.action.currency)}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ fontSize: 13, color: 'var(--notion-text)', textTransform: 'capitalize' }}>{m.action.taskType.toLowerCase()} service for your room</div>
                                        )}

                                        {m.actionState === 'pending' && (
                                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                                <button onClick={() => confirmAction(i)} style={{ flex: 1, padding: '7px', border: 'none', borderRadius: 8, background: accent, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Check size={14} /> Confirm</button>
                                                <button onClick={() => cancelAction(i)} style={{ padding: '7px 12px', border: '1px solid var(--notion-border)', borderRadius: 8, background: 'var(--notion-bg)', color: 'var(--notion-text-secondary)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                                            </div>
                                        )}
                                        {m.actionState === 'done' && <div style={{ fontSize: 12, color: 'var(--notion-green)', marginTop: 8 }}>✅ Confirmed</div>}
                                        {m.actionState === 'cancelled' && <div style={{ fontSize: 12, color: 'var(--notion-text-muted)', marginTop: 8 }}>Cancelled</div>}
                                    </div>
                                )}
                            </div>
                        ))}
                        {busy && <div style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--notion-text-muted)' }}>Thinking…</div>}
                        {msgs.length === 0 && suggestions.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                                {suggestions.map(s => <button key={s} onClick={() => send(s)} style={{ textAlign: 'left', fontSize: 12, padding: '7px 10px', borderRadius: 10, border: '1px solid var(--notion-border)', background: 'var(--notion-bg)', color: 'var(--notion-text-secondary)', cursor: 'pointer' }}>{s}</button>)}
                            </div>
                        )}
                    </div>

                    <form onSubmit={e => { e.preventDefault(); send(input); }} style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--notion-border)', background: 'var(--notion-bg)' }}>
                        <input value={input} onChange={e => setInput(e.target.value)} disabled={busy} maxLength={500} placeholder="Type your message…" style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--notion-border)', borderRadius: 10, background: 'var(--notion-bg-secondary)', color: 'var(--notion-text)', fontSize: 13, outline: 'none' }} />
                        <button type="submit" disabled={busy || !input.trim()} aria-label="Send" style={{ width: 38, borderRadius: 10, border: 'none', background: accent, color: '#fff', cursor: busy || !input.trim() ? 'default' : 'pointer', opacity: busy || !input.trim() ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Send size={15} /></button>
                    </form>
                </div>
            )}
        </>
    );
}
