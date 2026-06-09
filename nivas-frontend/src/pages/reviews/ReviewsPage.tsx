'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Star, MessageSquare, AlertTriangle, Sparkles, RefreshCw, Plus } from 'lucide-react';

interface Review { id: number; guestName?: string; rating?: number; comment?: string; source?: string; sentiment?: string; tags?: string[]; replyDraft?: string; replyText?: string; createdAt?: string }
interface Insights { total: number; avgRating: number | null; sentiment: { POSITIVE: number; NEUTRAL: number; NEGATIVE: number }; recurringComplaints: { tag: string; count: number }[] }

const SENT_COLOR: Record<string, { bg: string; text: string }> = {
    POSITIVE: { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)' },
    NEUTRAL: { bg: 'var(--notion-bg-tertiary)', text: 'var(--notion-text-secondary)' },
    NEGATIVE: { bg: 'var(--notion-red-bg)', text: 'var(--notion-red)' },
};

export default function ReviewsPage() {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [insights, setInsights] = useState<Insights | null>(null);
    const [filter, setFilter] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [draftingId, setDraftingId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [r, i] = await Promise.all([
                api.get<Review[]>(`/reviews${filter ? `?sentiment=${filter}` : ''}`),
                api.get<Insights>('/reviews/insights'),
            ]);
            setReviews(r.data || []);
            setInsights(i.data || null);
        } catch (e: any) { toast.error(e?.message || 'Failed to load reviews'); }
        finally { setLoading(false); }
    }, [filter]);
    useEffect(() => { load(); }, [load]);

    const draftReply = async (id: number) => {
        setDraftingId(id);
        try {
            const res = await api.post<{ draft: string; aiUsed: boolean }>(`/reviews/${id}/draft-reply`, {});
            toast.success(res.data?.aiUsed ? 'AI reply drafted' : 'Reply drafted (template)');
            setReviews(prev => prev.map(rv => rv.id === id ? { ...rv, replyDraft: res.data?.draft } : rv));
        } catch (e: any) { toast.error(e?.message || 'Failed'); }
        finally { setDraftingId(null); }
    };

    const addExternal = async () => {
        const comment = window.prompt('Paste the review text (e.g. from Google):');
        if (!comment?.trim()) return;
        const ratingStr = window.prompt('Rating 1-5 (optional):') || '';
        try {
            await api.post('/reviews', { comment: comment.trim(), rating: ratingStr ? Number(ratingStr) : undefined, source: 'GOOGLE' });
            toast.success('Review added + analyzed');
            load();
        } catch (e: any) { toast.error(e?.message || 'Failed'); }
    };

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--notion-text)' }}>Reviews & Sentiment</h1>
                        <p style={{ fontSize: 14, color: 'var(--notion-text-secondary)' }}>Guest feedback, sentiment, recurring complaints + AI-drafted replies.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="secondary" onClick={addExternal}><Plus size={14} style={{ marginRight: 6 }} />Add Review</Button>
                        <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw size={14} style={{ marginRight: 6 }} />Refresh</Button>
                    </div>
                </div>

                {/* Insights */}
                {insights && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                        <Tile label="Total reviews" value={String(insights.total)} icon={MessageSquare} />
                        <Tile label="Avg rating" value={insights.avgRating != null ? `${insights.avgRating} / 5` : '—'} icon={Star} />
                        <Tile label="Positive / Negative" value={`${insights.sentiment.POSITIVE} / ${insights.sentiment.NEGATIVE}`} icon={Sparkles} />
                        <div style={{ background: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
                            <div style={{ fontSize: 12, color: 'var(--notion-text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><AlertTriangle size={14} /> Recurring complaints</div>
                            {insights.recurringComplaints.length === 0 ? <div style={{ fontSize: 13, color: 'var(--notion-text-secondary)' }}>None 🎉</div> : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {insights.recurringComplaints.slice(0, 6).map(c => (
                                        <span key={c.tag} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: 'var(--notion-red-bg)', color: 'var(--notion-red)' }}>{c.tag} · {c.count}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Filter */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-4)' }}>
                    {['', 'POSITIVE', 'NEUTRAL', 'NEGATIVE'].map(s => (
                        <button key={s} onClick={() => setFilter(s)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', cursor: 'pointer', fontSize: 13, background: filter === s ? 'var(--notion-blue)' : 'var(--notion-bg)', color: filter === s ? '#fff' : 'var(--notion-text-secondary)' }}>
                            {s || 'All'}
                        </button>
                    ))}
                </div>

                {/* List */}
                {loading ? <div style={{ color: 'var(--notion-text-secondary)' }}>Loading…</div>
                    : reviews.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--notion-text-muted)', border: '1px dashed var(--notion-border)', borderRadius: 'var(--radius-lg)' }}>No reviews yet.</div>
                    : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {reviews.map(rv => {
                                const sc = SENT_COLOR[rv.sentiment || 'NEUTRAL'];
                                return (
                                    <div key={rv.id} style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', background: 'var(--notion-bg-secondary)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <strong style={{ fontSize: 14, color: 'var(--notion-text)' }}>{rv.guestName || 'Guest'}</strong>
                                                    {rv.rating != null && <span style={{ fontSize: 12, color: 'var(--notion-orange)' }}>{'★'.repeat(rv.rating)}{'☆'.repeat(5 - rv.rating)}</span>}
                                                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: sc.bg, color: sc.text, fontWeight: 600 }}>{rv.sentiment}</span>
                                                    {rv.source && rv.source !== 'INTERNAL' && <span style={{ fontSize: 11, color: 'var(--notion-text-muted)' }}>{rv.source}</span>}
                                                </div>
                                                <p style={{ fontSize: 13, color: 'var(--notion-text)', margin: '8px 0' }}>{rv.comment}</p>
                                                {(rv.tags || []).length > 0 && (
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                        {rv.tags!.map(t => <span key={t} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 8, background: 'var(--notion-bg-tertiary)', color: 'var(--notion-text-secondary)' }}>{t}</span>)}
                                                    </div>
                                                )}
                                            </div>
                                            <Button size="sm" variant="secondary" onClick={() => draftReply(rv.id)} disabled={draftingId === rv.id}>
                                                <Sparkles size={13} style={{ marginRight: 5 }} />{draftingId === rv.id ? 'Drafting…' : 'Draft reply'}
                                            </Button>
                                        </div>
                                        {(rv.replyDraft || rv.replyText) && (
                                            <div style={{ marginTop: 10, padding: 10, background: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--notion-text)' }}>
                                                <div style={{ fontSize: 11, color: 'var(--notion-text-muted)', marginBottom: 4 }}>{rv.replyText ? 'Sent reply' : 'Draft reply (edit + post on the platform)'}</div>
                                                {rv.replyText || rv.replyDraft}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
            </div>
        </DashboardLayout>
    );
}

function Tile({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
    return (
        <div style={{ background: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
            <div style={{ fontSize: 12, color: 'var(--notion-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={14} />{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--notion-text)', marginTop: 4 }}>{value}</div>
        </div>
    );
}
