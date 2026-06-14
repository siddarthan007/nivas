'use client';

import { useRef } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { toast } from 'sonner';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';

// Hotel-specific guest-portal URL + downloadable QR (guests scan to open the portal).
export function GuestPortalSection({ slug }: { slug?: string }) {
    const qrWrapRef = useRef<HTMLDivElement>(null);
    if (!slug) {
        return (
            <SettingsSection title="Guest Portal QR & Link" icon={QrCode}>
                <div style={{ fontSize: '13px', color: 'var(--notion-text-muted)' }}>Hotel identifier not available yet. Save your hotel profile first.</div>
            </SettingsSection>
        );
    }
    const portalUrl = `${window.location.origin}/guest?hotel=${encodeURIComponent(slug)}`;

    const copy = async () => {
        try { await navigator.clipboard.writeText(portalUrl); toast.success('Link copied'); }
        catch { toast.error('Copy failed'); }
    };
    const downloadQr = () => {
        const canvas = qrWrapRef.current?.querySelector('canvas');
        if (!canvas) return;
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `guest-portal-${slug}.png`;
        a.click();
    };

    return (
        <SettingsSection title="Guest Portal QR & Link" icon={QrCode}>
            <p style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: 'var(--space-3)' }}>
                Print the QR for rooms/reception — guests scan it to open your portal, then sign in with room number + PIN.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div ref={qrWrapRef} style={{ background: '#fff', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
                    <QRCodeCanvas value={portalUrl} size={160} level="M" includeMargin={false} />
                </div>
                <div style={{ flex: 1, minWidth: '240px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>Portal URL</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: 'var(--space-3)' }}>
                        <Input value={portalUrl} readOnly fullWidth onFocus={e => e.target.select()} />
                        <Button variant="secondary" onClick={copy} style={{ whiteSpace: 'nowrap' }}>Copy</Button>
                    </div>
                    <Button onClick={downloadQr}><QrCode size={14} style={{ marginRight: '6px' }} /> Download QR (PNG)</Button>
                </div>
            </div>
        </SettingsSection>
    );
}
