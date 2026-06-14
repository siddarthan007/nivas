'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Trash2, Bell } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';

const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px', backgroundColor: 'var(--notion-bg)',
    border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)',
    fontSize: '14px', outline: 'none', color: 'var(--notion-text)',
};

interface MarketingTemplate { id: number; name: string; channel: 'SMS' | 'EMAIL'; subject?: string | null; body: string }

// SMS / Email marketing: reusable templates + send a campaign to a customer segment.
export function MarketingSection() {
    const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [tpl, setTpl] = useState({ name: '', channel: 'SMS', subject: '', body: '' });
    const [savingTpl, setSavingTpl] = useState(false);
    const [send, setSend] = useState({ channel: 'SMS', segment: 'ALL', templateId: '', body: '', subject: '' });
    const [recipientCount, setRecipientCount] = useState<number | null>(null);
    const [sending, setSending] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<MarketingTemplate[]>('/marketing/templates');
            setTemplates(res.data || []);
        } catch { /* optional */ } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    // Live recipient preview when channel/segment changes.
    useEffect(() => {
        let cancelled = false;
        api.get<{ count: number }>(`/marketing/preview?channel=${send.channel}&segment=${send.segment}`)
            .then(r => { if (!cancelled) setRecipientCount(r.data?.count ?? 0); })
            .catch(() => { if (!cancelled) setRecipientCount(null); });
        return () => { cancelled = true; };
    }, [send.channel, send.segment]);

    const addTemplate = async () => {
        if (!tpl.name.trim() || !tpl.body.trim()) { toast.error('Name and body required'); return; }
        setSavingTpl(true);
        try {
            await api.post('/marketing/templates', { name: tpl.name, channel: tpl.channel, subject: tpl.subject || undefined, body: tpl.body });
            toast.success('Template saved');
            setTpl({ name: '', channel: 'SMS', subject: '', body: '' });
            await load();
        } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setSavingTpl(false); }
    };

    const delTemplate = async (id: number) => {
        try { await api.delete(`/marketing/templates/${id}`); await load(); } catch (e: any) { toast.error(e?.message || 'Failed'); }
    };

    const sendCampaign = async () => {
        if (!send.templateId && !send.body.trim()) { toast.error('Pick a template or type a message'); return; }
        setSending(true);
        try {
            const res = await api.post<{ total: number; queued?: boolean }>('/marketing/send', {
                channel: send.channel, segment: send.segment,
                templateId: send.templateId ? Number(send.templateId) : undefined,
                body: send.body || undefined,
                subject: send.subject || undefined,
            });
            const d = res.data;
            toast.success(`Campaign started — sending to ${d?.total ?? 0} recipient${(d?.total ?? 0) === 1 ? '' : 's'} in the background.`);
        } catch (e: any) { toast.error(e?.message || 'Failed to send'); } finally { setSending(false); }
    };

    if (loading) return <SettingsSection title="SMS & Email Marketing" icon={Bell}><div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Loading…</div></SettingsSection>;
    const lbl = { fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' } as const;
    const ta: React.CSSProperties = { width: '100%', minHeight: '70px', padding: '8px 12px', background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', color: 'var(--notion-text)', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' };

    return (
        <SettingsSection title="SMS & Email Marketing" icon={Bell}>
            {/* Templates */}
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-2)' }}>Templates</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <Input placeholder="Template name" value={tpl.name} onChange={e => setTpl({ ...tpl, name: e.target.value })} />
                <select value={tpl.channel} onChange={e => setTpl({ ...tpl, channel: e.target.value })} style={selectStyle}>
                    <option value="SMS">SMS</option>
                    <option value="EMAIL">Email</option>
                </select>
            </div>
            {tpl.channel === 'EMAIL' && <Input placeholder="Email subject" value={tpl.subject} onChange={e => setTpl({ ...tpl, subject: e.target.value })} style={{ marginBottom: 'var(--space-2)' }} />}
            <textarea placeholder="Message body — use {{name}} for the customer's name" value={tpl.body} onChange={e => setTpl({ ...tpl, body: e.target.value })} style={{ ...ta, marginBottom: 'var(--space-2)' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
                <Button onClick={addTemplate} disabled={savingTpl}><Plus size={14} style={{ marginRight: '6px' }} /> {savingTpl ? 'Saving…' : 'Save Template'}</Button>
            </div>
            {templates.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: 'var(--space-5)' }}>
                    {templates.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)' }}>
                            <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: 'var(--notion-bg-tertiary)', color: 'var(--notion-text-secondary)' }}>{t.channel}</span>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--notion-text)' }}>{t.name}</span>
                            <span style={{ flex: 1, fontSize: '12px', color: 'var(--notion-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body}</span>
                            <Button size="sm" variant="ghost" onClick={() => delTemplate(t.id)} style={{ color: 'var(--notion-red)' }}><Trash2 size={14} /></Button>
                        </div>
                    ))}
                </div>
            )}

            {/* Send campaign */}
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--notion-divider)' }}>Send Campaign</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <div><label style={lbl}>Channel</label>
                    <select value={send.channel} onChange={e => setSend({ ...send, channel: e.target.value, templateId: '' })} style={selectStyle}>
                        <option value="SMS">SMS</option><option value="EMAIL">Email</option>
                    </select>
                </div>
                <div><label style={lbl}>Audience</label>
                    <select value={send.segment} onChange={e => setSend({ ...send, segment: e.target.value })} style={selectStyle}>
                        <option value="ALL">All customers</option>
                        <option value="VIP">VIP only</option>
                        <option value="HOTEL_GUEST">Hotel guests</option>
                        <option value="RESTAURANT_CUSTOMER">Restaurant customers</option>
                        <option value="OUTSTANDING">Outstanding balance</option>
                    </select>
                </div>
                <div><label style={lbl}>Template</label>
                    <select value={send.templateId} onChange={e => setSend({ ...send, templateId: e.target.value })} style={selectStyle}>
                        <option value="">— custom message —</option>
                        {templates.filter(t => t.channel === send.channel).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
            </div>
            {!send.templateId && (
                <>
                    {send.channel === 'EMAIL' && <Input placeholder="Email subject" value={send.subject} onChange={e => setSend({ ...send, subject: e.target.value })} style={{ marginBottom: 'var(--space-2)' }} />}
                    <textarea placeholder="Message — {{name}} supported" value={send.body} onChange={e => setSend({ ...send, body: e.target.value })} style={{ ...ta, marginBottom: 'var(--space-2)' }} />
                </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{recipientCount === null ? '' : `${recipientCount} recipient${recipientCount === 1 ? '' : 's'}`}</span>
                <Button onClick={sendCampaign} disabled={sending || recipientCount === 0}>{sending ? 'Sending…' : `Send ${send.channel}`}</Button>
            </div>
        </SettingsSection>
    );
}
