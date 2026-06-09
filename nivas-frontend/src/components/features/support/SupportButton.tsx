import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LifeBuoy, X, Mail, Phone, MessageCircle, Clock } from 'lucide-react';

interface Support { email?: string; phone?: string; whatsapp?: string; hours?: string }

// Floating "Need help?" button (bottom-left) → panel with platform support contacts.
// Contacts are configured by the SaaS admin and read-only here.
export default function SupportButton() {
    const [open, setOpen] = useState(false);
    const [info, setInfo] = useState<Support | null>(null);

    useEffect(() => {
        if (open && !info) api.get<Support>('/analytics/support-info').then(r => setInfo(r.data || {})).catch(() => setInfo({}));
    }, [open, info]);

    const hasAny = info && (info.email || info.phone || info.whatsapp);
    const waLink = info?.whatsapp ? `https://wa.me/${info.whatsapp.replace(/[^0-9]/g, '')}` : '';

    return (
        <>
            {!open && (
                <button onClick={() => setOpen(true)} aria-label="Get help" title="Help & support"
                    style={{ position: 'fixed', bottom: 90, right: 24, zIndex: 999, width: 48, height: 48, borderRadius: '50%', border: '1px solid var(--notion-border)', background: 'var(--notion-bg)', color: 'var(--notion-blue)', boxShadow: '0 4px 14px rgba(0,0,0,0.18)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 120ms' }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')} onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                    <LifeBuoy size={22} />
                </button>
            )}

            {open && (
                <div style={{ position: 'fixed', bottom: 90, right: 24, zIndex: 999, width: 'min(300px, calc(100vw - 32px))', background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 14, boxShadow: '0 12px 36px rgba(0,0,0,0.28)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--notion-blue)', color: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}><LifeBuoy size={16} /> Support</div>
                        <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 7, width: 26, height: 26, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
                    </div>
                    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {info === null ? <div style={{ fontSize: 13, color: 'var(--notion-text-muted)' }}>Loading…</div>
                            : !hasAny ? <div style={{ fontSize: 13, color: 'var(--notion-text-secondary)' }}>Support contacts haven't been set up yet.</div>
                            : (
                                <>
                                    {info!.email && <a href={`mailto:${info!.email}`} style={rowStyle}><Mail size={16} style={{ color: 'var(--notion-blue)' }} /><span>{info!.email}</span></a>}
                                    {info!.phone && <a href={`tel:${info!.phone}`} style={rowStyle}><Phone size={16} style={{ color: 'var(--notion-green)' }} /><span>{info!.phone}</span></a>}
                                    {info!.whatsapp && <a href={waLink} target="_blank" rel="noopener noreferrer" style={rowStyle}><MessageCircle size={16} style={{ color: '#25D366' }} /><span>WhatsApp: {info!.whatsapp}</span></a>}
                                    {info!.hours && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--notion-text-muted)' }}><Clock size={14} />{info!.hours}</div>}
                                </>
                            )}
                    </div>
                </div>
            )}
        </>
    );
}

const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--notion-text)', textDecoration: 'none', padding: '8px 10px', border: '1px solid var(--notion-border)', borderRadius: 8 };
