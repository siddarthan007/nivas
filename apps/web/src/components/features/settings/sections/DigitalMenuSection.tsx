'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, Palette, Save, Type } from 'lucide-react';
import { SettingsSection } from '@/components/features/settings/SettingsPrimitives';

export interface DigitalMenuSettings {
    subtitle?: string;
    footerText?: string;
    showFooter?: boolean;
    pageBackground?: string;
    cardBackground?: string;
    headerTitleColor?: string;
    headerSubtitleColor?: string;
    categoryTitleColor?: string;
    itemNameColor?: string;
    itemDescriptionColor?: string;
    priceColor?: string;
    footerTextColor?: string;
    headerTitleSize?: number;
    headerSubtitleSize?: number;
    categoryTitleSize?: number;
    itemNameSize?: number;
    itemDescriptionSize?: number;
    priceSize?: number;
    footerSize?: number;
}

const DEFAULT_APPEARANCE: Required<Pick<
    DigitalMenuSettings,
    | 'pageBackground'
    | 'cardBackground'
    | 'headerTitleColor'
    | 'headerSubtitleColor'
    | 'categoryTitleColor'
    | 'itemNameColor'
    | 'itemDescriptionColor'
    | 'priceColor'
    | 'footerTextColor'
    | 'headerTitleSize'
    | 'headerSubtitleSize'
    | 'categoryTitleSize'
    | 'itemNameSize'
    | 'itemDescriptionSize'
    | 'priceSize'
    | 'footerSize'
>> = {
    pageBackground: '#f7f7f8',
    cardBackground: '#ffffff',
    headerTitleColor: '#ffffff',
    headerSubtitleColor: '#ffffff',
    categoryTitleColor: '',
    itemNameColor: '#1a1a1a',
    itemDescriptionColor: '#777777',
    priceColor: '',
    footerTextColor: '#aaaaaa',
    headerTitleSize: 22,
    headerSubtitleSize: 13,
    categoryTitleSize: 16,
    itemNameSize: 15,
    itemDescriptionSize: 13,
    priceSize: 15,
    footerSize: 12,
};

interface DigitalMenuSectionProps {
    slug?: string;
    primaryColor?: string;
    digitalMenu?: DigitalMenuSettings;
    onSaved?: () => void;
}

function ColorField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <div>
            <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>{label}</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                    type="color"
                    value={value || '#000000'}
                    onChange={e => onChange(e.target.value)}
                    style={{ width: 40, height: 32, border: 'none', cursor: 'pointer', flexShrink: 0 }}
                />
                <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
            </div>
        </div>
    );
}

function SizeField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
        <div>
            <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>{label}</label>
            <Input
                type="number"
                min={10}
                max={40}
                value={value}
                onChange={e => onChange(Math.min(40, Math.max(10, Number(e.target.value) || 10)))}
            />
        </div>
    );
}

// Public digital-menu URL + downloadable QR + theming (no login — guests scan to view).
export function DigitalMenuSection({ slug, primaryColor, digitalMenu, onSaved }: DigitalMenuSectionProps) {
    const qrWrapRef = useRef<HTMLDivElement>(null);
    const [accent, setAccent] = useState(primaryColor || '#1a365d');
    const [appearance, setAppearance] = useState({ ...DEFAULT_APPEARANCE });
    const [subtitle, setSubtitle] = useState(digitalMenu?.subtitle || 'Digital Menu');
    const [footerText, setFooterText] = useState(digitalMenu?.footerText || 'Powered by Nivas PMS');
    const [showFooter, setShowFooter] = useState(digitalMenu?.showFooter !== false);
    const [saving, setSaving] = useState(false);

    const setAppearanceField = <K extends keyof typeof DEFAULT_APPEARANCE>(key: K, value: (typeof DEFAULT_APPEARANCE)[K]) => {
        setAppearance(prev => ({ ...prev, [key]: value }));
    };

    useEffect(() => {
        if (!slug) return;
        api.get<{
            branding?: { primaryColor?: string; secondaryColor?: string };
            invoice?: { config?: { digitalMenu?: DigitalMenuSettings } };
        }>('/settings').then(res => {
            const d = res.data;
            if (d?.branding?.primaryColor) setAccent(d.branding.primaryColor);
            const dm = d?.invoice?.config?.digitalMenu;
            if (dm?.subtitle) setSubtitle(dm.subtitle);
            if (dm?.footerText) setFooterText(dm.footerText);
            if (dm?.showFooter !== undefined) setShowFooter(dm.showFooter);
            setAppearance(prev => ({
                ...prev,
                pageBackground: dm?.pageBackground || d?.branding?.secondaryColor || prev.pageBackground,
                cardBackground: dm?.cardBackground || prev.cardBackground,
                headerTitleColor: dm?.headerTitleColor || prev.headerTitleColor,
                headerSubtitleColor: dm?.headerSubtitleColor || prev.headerSubtitleColor,
                categoryTitleColor: dm?.categoryTitleColor ?? prev.categoryTitleColor,
                itemNameColor: dm?.itemNameColor || prev.itemNameColor,
                itemDescriptionColor: dm?.itemDescriptionColor || prev.itemDescriptionColor,
                priceColor: dm?.priceColor ?? prev.priceColor,
                footerTextColor: dm?.footerTextColor || prev.footerTextColor,
                headerTitleSize: dm?.headerTitleSize || prev.headerTitleSize,
                headerSubtitleSize: dm?.headerSubtitleSize || prev.headerSubtitleSize,
                categoryTitleSize: dm?.categoryTitleSize || prev.categoryTitleSize,
                itemNameSize: dm?.itemNameSize || prev.itemNameSize,
                itemDescriptionSize: dm?.itemDescriptionSize || prev.itemDescriptionSize,
                priceSize: dm?.priceSize || prev.priceSize,
                footerSize: dm?.footerSize || prev.footerSize,
            }));
        }).catch(() => { /* use defaults */ });
    }, [slug]);

    if (!slug) {
        return (
            <SettingsSection title="Digital Menu QR & Link" icon={QrCode}>
                <div style={{ fontSize: '13px', color: 'var(--notion-text-muted)' }}>Save your hotel profile first.</div>
            </SettingsSection>
        );
    }

    const menuUrl = `${window.location.origin}/menu?hotel=${encodeURIComponent(slug)}`;
    const previewCategoryColor = appearance.categoryTitleColor || accent;
    const previewPriceColor = appearance.priceColor || accent;

    const copy = async () => {
        try { await navigator.clipboard.writeText(menuUrl); toast.success('Link copied'); }
        catch { toast.error('Copy failed'); }
    };

    const downloadQr = () => {
        const canvas = qrWrapRef.current?.querySelector('canvas');
        if (!canvas) return;
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `digital-menu-${slug}.png`;
        a.click();
    };

    const handleSaveAppearance = async () => {
        setSaving(true);
        try {
            await Promise.all([
                api.patch('/settings/branding', { primaryColor: accent }),
                api.patch('/settings/invoice', {
                    config: {
                        digitalMenu: {
                            subtitle,
                            footerText,
                            showFooter,
                            ...appearance,
                        },
                    },
                }),
            ]);
            toast.success('Digital menu appearance saved');
            onSaved?.();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const fieldGrid: CSSProperties = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
    };

    return (
        <SettingsSection title="Digital Menu QR & Link" icon={QrCode}>
            <p style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: 'var(--space-3)' }}>
                Public, no-login menu. Put the QR on tables — guests scan to browse your live menu.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 'var(--space-5)' }}>
                <div ref={qrWrapRef} style={{ background: '#fff', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
                    <QRCodeCanvas value={menuUrl} size={160} level="M" />
                </div>
                <div style={{ flex: 1, minWidth: '240px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>Menu URL</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: 'var(--space-3)' }}>
                        <Input value={menuUrl} readOnly fullWidth onFocus={e => e.target.select()} />
                        <Button variant="secondary" onClick={copy} style={{ whiteSpace: 'nowrap' }}>Copy</Button>
                    </div>
                    <Button onClick={downloadQr}><QrCode size={14} style={{ marginRight: '6px' }} /> Download QR (PNG)</Button>
                </div>
            </div>

            <div style={{ borderTop: '1px solid var(--notion-border)', paddingTop: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)' }}>
                    <Palette size={16} style={{ color: 'var(--notion-text-secondary)' }} />
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Appearance</span>
                </div>

                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-2)' }}>Backgrounds & accent</p>
                <div style={fieldGrid}>
                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>Header accent</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input type="color" value={accent} onChange={e => setAccent(e.target.value)} style={{ width: 40, height: 32, border: 'none', cursor: 'pointer' }} />
                            <Input value={accent} onChange={e => setAccent(e.target.value)} />
                        </div>
                    </div>
                    <ColorField label="Page background" value={appearance.pageBackground} onChange={v => setAppearanceField('pageBackground', v)} />
                    <ColorField label="Item card background" value={appearance.cardBackground} onChange={v => setAppearanceField('cardBackground', v)} />
                </div>

                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-2)' }}>Text colors</p>
                <div style={fieldGrid}>
                    <ColorField label="Hotel name" value={appearance.headerTitleColor} onChange={v => setAppearanceField('headerTitleColor', v)} />
                    <ColorField label="Subtitle" value={appearance.headerSubtitleColor} onChange={v => setAppearanceField('headerSubtitleColor', v)} />
                    <ColorField label="Category headings" value={appearance.categoryTitleColor} onChange={v => setAppearanceField('categoryTitleColor', v)} placeholder="Uses accent if empty" />
                    <ColorField label="Item names" value={appearance.itemNameColor} onChange={v => setAppearanceField('itemNameColor', v)} />
                    <ColorField label="Item descriptions" value={appearance.itemDescriptionColor} onChange={v => setAppearanceField('itemDescriptionColor', v)} />
                    <ColorField label="Prices" value={appearance.priceColor} onChange={v => setAppearanceField('priceColor', v)} placeholder="Uses accent if empty" />
                    <ColorField label="Footer" value={appearance.footerTextColor} onChange={v => setAppearanceField('footerTextColor', v)} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 'var(--space-4) 0 var(--space-2)' }}>
                    <Type size={14} style={{ color: 'var(--notion-text-secondary)' }} />
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--notion-text-secondary)', margin: 0 }}>Font sizes (px)</p>
                </div>
                <div style={fieldGrid}>
                    <SizeField label="Hotel name" value={appearance.headerTitleSize} onChange={v => setAppearanceField('headerTitleSize', v)} />
                    <SizeField label="Subtitle" value={appearance.headerSubtitleSize} onChange={v => setAppearanceField('headerSubtitleSize', v)} />
                    <SizeField label="Category headings" value={appearance.categoryTitleSize} onChange={v => setAppearanceField('categoryTitleSize', v)} />
                    <SizeField label="Item names" value={appearance.itemNameSize} onChange={v => setAppearanceField('itemNameSize', v)} />
                    <SizeField label="Item descriptions" value={appearance.itemDescriptionSize} onChange={v => setAppearanceField('itemDescriptionSize', v)} />
                    <SizeField label="Prices" value={appearance.priceSize} onChange={v => setAppearanceField('priceSize', v)} />
                    <SizeField label="Footer" value={appearance.footerSize} onChange={v => setAppearanceField('footerSize', v)} />
                </div>

                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-2)' }}>Content</p>
                <div style={fieldGrid}>
                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>Subtitle</label>
                        <Input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Digital Menu" />
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>Footer text</label>
                        <Input value={footerText} onChange={e => setFooterText(e.target.value)} placeholder="Powered by Nivas PMS" disabled={!showFooter} />
                    </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showFooter} onChange={e => setShowFooter(e.target.checked)} />
                    Show footer on public menu
                </label>

                <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--notion-border)', marginBottom: 'var(--space-3)', maxWidth: 360 }}>
                    <div style={{ background: accent, color: appearance.headerTitleColor, padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: Math.min(appearance.headerTitleSize, 18) }}>Your Hotel</div>
                        <div style={{ fontSize: Math.min(appearance.headerSubtitleSize, 12), color: appearance.headerSubtitleColor, opacity: appearance.headerSubtitleColor === '#ffffff' ? 0.85 : 1 }}>
                            {subtitle || 'Digital Menu'}
                        </div>
                    </div>
                    <div style={{ background: appearance.pageBackground, padding: '10px' }}>
                        <div style={{ fontSize: Math.min(appearance.categoryTitleSize, 14), fontWeight: 700, color: previewCategoryColor, marginBottom: 6 }}>Starters</div>
                        <div style={{ background: appearance.cardBackground, borderRadius: 8, padding: 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <div>
                                <div style={{ fontSize: Math.min(appearance.itemNameSize, 13), fontWeight: 600, color: appearance.itemNameColor }}>Sample dish</div>
                                <div style={{ fontSize: Math.min(appearance.itemDescriptionSize, 11), color: appearance.itemDescriptionColor }}>With herbs</div>
                            </div>
                            <div style={{ fontSize: Math.min(appearance.priceSize, 13), fontWeight: 700, color: previewPriceColor }}>NPR 450</div>
                        </div>
                    </div>
                    {showFooter && (
                        <div style={{ textAlign: 'center', padding: '8px', fontSize: Math.min(appearance.footerSize, 11), color: appearance.footerTextColor, background: appearance.pageBackground }}>
                            {footerText || 'Powered by Nivas PMS'}
                        </div>
                    )}
                </div>
                <Button onClick={handleSaveAppearance} disabled={saving}>
                    <Save size={14} style={{ marginRight: 6 }} />
                    {saving ? 'Saving…' : 'Save appearance'}
                </Button>
            </div>
        </SettingsSection>
    );
}
